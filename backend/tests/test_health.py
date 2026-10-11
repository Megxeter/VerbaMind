import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health_check_endpoint(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "healthy"
    assert data["service"] == "verbamind-api"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data

    # Verify timestamp format (ISO 8601)
    parsed_time = datetime.fromisoformat(data["timestamp"])
    assert parsed_time is not None
