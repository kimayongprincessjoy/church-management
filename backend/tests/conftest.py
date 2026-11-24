import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret"

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def setup_church(client):
    payload = {
        "name": "Grace Community Church",
        "logo_url": None,
        "address": "1 Faith Ave",
        "denomination": "Independent",
        "phone": "08000000000",
        "email": "info@grace.org",
        "pastor_name": "Rev. Smith",
        "description": "A church",
        "founded_date": "1990-01-01",
        "admin_username": "admin",
        "admin_email": "admin@grace.org",
        "admin_password": "password123",
        "admin_full_name": "Admin User",
    }
    resp = client.post("/api/church/setup", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def admin_token(client, setup_church):
    resp = client.post(
        "/api/auth/login/json",
        json={"username": "admin", "password": "password123"},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
