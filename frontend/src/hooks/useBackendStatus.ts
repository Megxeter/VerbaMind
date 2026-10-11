import { useCallback, useEffect, useState } from 'react'

export type BackendConnectionState = 'checking' | 'online' | 'offline'

export interface BackendHealthInfo {
  status: BackendConnectionState
  version: string | null
  error: string | null
  checkedAt: Date | null
}

const BACKEND_HEALTH_URL = 'http://127.0.0.1:8000/api/health'
const TIMEOUT_MS = 2500

export function useBackendStatus(pollIntervalMs: number = 10000): {
  healthInfo: BackendHealthInfo
  checkConnection: () => Promise<void>
} {
  const [healthInfo, setHealthInfo] = useState<BackendHealthInfo>({
    status: 'checking',
    version: null,
    error: null,
    checkedAt: null,
  })

  const checkConnection = useCallback(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(BACKEND_HEALTH_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = (await response.json()) as { version?: string; status?: string }
        setHealthInfo({
          status: 'online',
          version: data.version || '0.1.0',
          error: null,
          checkedAt: new Date(),
        })
      } else {
        setHealthInfo({
          status: 'offline',
          version: null,
          error: `HTTP ${response.status}`,
          checkedAt: new Date(),
        })
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      const message = err instanceof Error && err.name === 'AbortError' ? 'Connection timed out' : 'Service unreachable'
      setHealthInfo({
        status: 'offline',
        version: null,
        error: message,
        checkedAt: new Date(),
      })
    }
  }, [])

  useEffect(() => {
    // Initial check on mount
    void checkConnection()

    // Periodic check
    const interval = setInterval(() => {
      void checkConnection()
    }, pollIntervalMs)

    return () => clearInterval(interval)
  }, [checkConnection, pollIntervalMs])

  return { healthInfo, checkConnection }
}
