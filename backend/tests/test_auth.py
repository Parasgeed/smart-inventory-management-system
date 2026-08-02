import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.database import Base, get_db
from app.models.role_model import Role
from app.models.user_model import User
from app.auth.security import hash_password

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Add dummy role
    role = Role(id=1, name="admin", description="Admin Role")
    role2 = Role(id=2, name="user", description="User Role")
    db.add(role)
    db.add(role2)
    db.commit()
    
    # Add admin user
    admin = User(
        id=1,
        username="admin",
        email="admin@test.com",
        password_hash=hash_password("adminpass"),
        role_id=1
    )
    db.add(admin)
    db.commit()
    db.close()
    
    yield
    
    # Teardown
    Base.metadata.drop_all(bind=engine)

def get_admin_token():
    res = client.post("/api/v1/auth/login", data={"username": "admin@test.com", "password": "adminpass"})
    return res.json()["access_token"]

def test_get_roles():
    token = get_admin_token()
    res = client.get("/api/v1/auth/roles", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert len(res.json()) == 2
    assert res.json()[0]["name"] == "admin"

def test_create_and_update_user():
    token = get_admin_token()
    # Register new user
    res = client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "test@test.com",
        "password": "testpassword",
        "role_id": 2
    })
    assert res.status_code == 200
    user_id = res.json()["user_id"]
    
    # Update user role
    update_res = client.put(f"/api/v1/auth/users/{user_id}", json={"role_id": 1}, headers={"Authorization": f"Bearer {token}"})
    assert update_res.status_code == 200
    
    # Verify change
    users_res = client.get("/api/v1/auth/users", headers={"Authorization": f"Bearer {token}"})
    testuser = next(u for u in users_res.json() if u["id"] == user_id)
    assert testuser["role_name"] == "admin"

def test_delete_user():
    token = get_admin_token()
    # Register new user
    res = client.post("/api/v1/auth/register", json={
        "username": "deleteuser",
        "email": "delete@test.com",
        "password": "testpassword",
        "role_id": 2
    })
    user_id = res.json()["user_id"]
    
    # Delete user
    del_res = client.delete(f"/api/v1/auth/users/{user_id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == 200
    
    # Verify deletion
    users_res = client.get("/api/v1/auth/users", headers={"Authorization": f"Bearer {token}"})
    assert not any(u["id"] == user_id for u in users_res.json())
