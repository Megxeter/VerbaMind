import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1.api import api_router
from backend.core.config import settings
from backend.core.errors import register_error_handlers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s: %(message)s",
)
logger = logging.getLogger("verbamind.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan event handler for backend startup and shutdown tasks."""
    logger.info("Initializing VERBAMIND API (Environment: %s)...", settings.ENVIRONMENT)
    # Ensure private storage directory exists upon startup
    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    yield
    logger.info("Shutting down VERBAMIND API.")


def create_application() -> FastAPI:
    """Application factory for VERBAMIND FastAPI service."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Speech Assessment & Placement Communication Coaching Backend API",
        docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
        lifespan=lifespan,
    )

    # Strict CORS configuration: Exact frontend local origins only, strictly no wildcard '*'
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Register standardized error handlers (no internal leakages)
    register_error_handlers(app)

    # Include API Routers under /api
    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_application()
