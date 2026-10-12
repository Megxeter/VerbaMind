from fastapi import APIRouter
from backend.api.v1.endpoints import acoustics, health, recordings, transcription

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(recordings.router)
api_router.include_router(transcription.router)
api_router.include_router(acoustics.router)



