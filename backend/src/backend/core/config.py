from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "VERBAMIND API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api"

    # Exact frontend local origins (Strictly no wildcard '*')
    ALLOWED_ORIGINS: list[str] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]

    # Private Audio Storage Directory (outside public web document root)
    STORAGE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent / "storage" / "recordings"

    # Audio limits
    MAX_AUDIO_BYTES: int = 15 * 1024 * 1024  # 15 MB
    MAX_RECORDING_SECONDS: int = 180  # 3 minutes

    # Local Offline Speech Recognition (Whisper / CTranslate2)
    WHISPER_MODEL_NAME: str = "base.en"
    WHISPER_MODEL_DIR: Path = (
        Path(__file__).resolve().parent.parent.parent.parent / "models" / "whisper" / "base.en"
    )
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"
    WHISPER_CPU_THREADS: int = 4
    WHISPER_BEAM_SIZE: int = 5
    TARGET_SAMPLE_RATE: int = 16000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
