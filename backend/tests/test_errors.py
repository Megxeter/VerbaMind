import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def test_404_not_found_standardized_error(client: TestClient) -> None:
    response = client.get("/api/non-existent-route")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "HTTP_404"
    assert "Not Found" in data["error"]["message"]


def test_500_internal_error_does_not_leak_details(client: TestClient) -> None:
    # Dynamically inject a temporary route that deliberately throws an unhandled error
    err_router = APIRouter()

    @err_router.get("/test-internal-crash")
    def crash_endpoint() -> None:
        raise RuntimeError("Database connection string postgres://secret:pwd@internal-db:5432 failed!")

    app.include_router(err_router, prefix="/api/test-debug")

    response = client.get("/api/test-debug/test-internal-crash")
    assert response.status_code == 500
    data = response.json()

    assert "error" in data
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
    # Ensure sensitive database credentials or exception message are NEVER leaked to client
    assert "postgres" not in response.text
    assert "secret" not in response.text
    assert "Database connection" not in response.text
    assert data["error"]["message"] == "An unexpected error occurred. Please try again later."
