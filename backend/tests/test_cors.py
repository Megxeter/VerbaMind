import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_cors_allowed_origins(client: TestClient) -> None:
    # Test allowed dev origin http://127.0.0.1:5173
    response = client.get("/api/health", headers={"Origin": "http://127.0.0.1:5173"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"

    # Test allowed dev origin http://localhost:5173
    response2 = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert response2.status_code == 200
    assert response2.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_disallowed_origin(client: TestClient) -> None:
    # Test unauthorized origin
    response = client.get("/api/health", headers={"Origin": "https://unauthorized-attacker.com"})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_cors_preflight_options(client: TestClient) -> None:
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"
