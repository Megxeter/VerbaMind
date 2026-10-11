from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.core.config import settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service status", examples=["healthy"])
    service: str = Field(..., description="Service name", examples=["verbamind-api"])
    version: str = Field(..., description="API Version", examples=["0.1.0"])
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
    environment: str = Field(..., description="Environment name", examples=["development"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service Liveness Check",
    description="Returns service status and metadata for frontend connectivity verification.",
)
async def check_health() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME.lower().replace(" ", "-"),
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENVIRONMENT,
    )
