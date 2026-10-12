import io
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Union

import av
import numpy as np

logger = logging.getLogger("verbamind.audio_decoder")


class AudioDecodingError(Exception):
    """Raised when audio decoding fails due to container or stream corruption."""
    pass


class AudioDurationExceededError(AudioDecodingError):
    """Raised when decoded audio exceeds the configured maximum recording duration."""
    pass


@dataclass(frozen=True)
class AudioDecodeResult:
    """Container holding decoded PCM samples and acoustic format metadata."""
    audio_array: np.ndarray
    duration_seconds: float
    original_sample_rate: int
    original_channels: int
    codec: str
    sample_rate: int = 16000


def decode_audio(
    source: Union[Path, str, BinaryIO, bytes],
    max_duration_sec: float = 180.0,
    target_sample_rate: int = 16000,
) -> AudioDecodeResult:
    """
    Decodes an audio container (WebM/Opus, WAV, Ogg, MP4/M4A) locally into a
    16 kHz mono float32 numpy array suitable for Whisper acoustic inference.

    Args:
        source: File path, file-like binary buffer, or raw bytes.
        max_duration_sec: Strict duration upper bound in seconds.
        target_sample_rate: Resampling target rate (default 16000 Hz).

    Returns:
        AudioDecodeResult with normalized audio samples and format details.

    Raises:
        AudioDecodingError: If media contains no audio stream or is corrupt.
        AudioDurationExceededError: If audio duration exceeds max_duration_sec.
    """
    if isinstance(source, bytes):
        if len(source) == 0:
            raise AudioDecodingError("Audio payload is empty (0 bytes).")
        input_target = io.BytesIO(source)
    elif isinstance(source, (str, Path)):
        p = Path(source)
        if not p.exists() or p.stat().st_size == 0:
            raise AudioDecodingError(f"Audio file does not exist or is empty: {source}")
        input_target = str(p)
    else:
        input_target = source

    try:
        container = av.open(input_target)
    except (av.FFmpegError, Exception) as exc:
        raise AudioDecodingError(f"Failed to open audio container with PyAV: {exc}") from exc

    try:
        audio_streams = [s for s in container.streams if s.type == "audio"]
        if not audio_streams:
            raise AudioDecodingError("No audio stream found in the media container.")

        stream = audio_streams[0]
        orig_rate = stream.codec_context.sample_rate or target_sample_rate
        orig_channels = stream.codec_context.channels or 1
        codec_name = stream.codec_context.name or "unknown"

        resampler = av.AudioResampler(
            format="fltp",
            layout="mono",
            rate=target_sample_rate,
        )

        audio_chunks: list[np.ndarray] = []
        total_samples = 0
        max_allowed_samples = int((max_duration_sec + 0.5) * target_sample_rate)

        try:
            for frame in container.decode(stream):
                resampled_frames = resampler.resample(frame)
                for rf in resampled_frames:
                    arr = rf.to_ndarray()
                    audio_chunks.append(arr)
                    total_samples += rf.samples

                    if total_samples > max_allowed_samples:
                        raise AudioDurationExceededError(
                            f"Decoded audio exceeds maximum duration limit of {max_duration_sec}s "
                            f"(accumulated {total_samples / target_sample_rate:.2f}s)."
                        )

            # Flush residual resampler buffer
            flushed_frames = resampler.resample(None)
            if flushed_frames:
                for rf in flushed_frames:
                    arr = rf.to_ndarray()
                    audio_chunks.append(arr)
                    total_samples += rf.samples
        except AudioDurationExceededError:
            raise
        except (av.FFmpegError, Exception) as exc:
            raise AudioDecodingError(f"Error decoding audio frame stream: {exc}") from exc

        if total_samples == 0 or not audio_chunks:
            raise AudioDecodingError("Decoded audio stream contains zero audio samples.")

        # Combine into contiguous 1D float32 array normalized to [-1.0, 1.0]
        audio_data = np.concatenate(audio_chunks, axis=1).flatten().astype(np.float32)
        np.clip(audio_data, -1.0, 1.0, out=audio_data)
        duration_seconds = round(len(audio_data) / float(target_sample_rate), 3)

        return AudioDecodeResult(
            audio_array=audio_data,
            duration_seconds=duration_seconds,
            original_sample_rate=orig_rate,
            original_channels=orig_channels,
            codec=codec_name,
            sample_rate=target_sample_rate,
        )

    finally:
        container.close()
