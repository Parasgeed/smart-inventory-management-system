from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user_model import User
from app.models.role_model import Role
from app.schemas.user_schema import UserCreate, UserUpdate
from app.auth.security import hash_password

from app.schemas.user_schema import UserLogin
from app.auth.security import verify_password
from app.auth.auth import create_access_token
from fastapi.security import OAuth2PasswordRequestForm

from app.auth.permissions import admin_required

from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# User Registration
@router.post("/register")
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    existing_username = db.query(User).filter(
        User.username == user.username
    ).first()

    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already taken"
        )

    assigned_role_id = user.role_id
    if assigned_role_id is None:
        total_users = db.query(User).count()
        if total_users == 0:
            admin_role = db.query(Role).filter(Role.name.ilike("admin")).first()
            assigned_role_id = admin_role.id if admin_role else 1
        else:
            default_role = (
                db.query(Role).filter(Role.name.ilike("user")).first()
                or db.query(Role).filter(Role.name.ilike("staff")).first()
                or db.query(Role).filter(Role.name != "admin").first()
                or db.query(Role).first()
            )
            assigned_role_id = default_role.id if default_role else 1

    new_user = User(
        username=user.username,
        email=user.email,
        password_hash=hash_password(user.password),
        role_id=assigned_role_id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User registered successfully",
        "user_id": new_user.id
    }

# User Login
@router.post("/login")
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        form_data.password,
        existing_user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        {
            "sub": existing_user.email,
            "user_id": existing_user.id,
            "role_id": existing_user.role_id
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

# Get Current User
@router.get("/me")
def get_me(
    current_user = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role_id": current_user.role_id
    }

@router.get("/admin-only")
def admin_only_route(
    current_user = Depends(get_current_user)
):
    admin_required(current_user)
    return {
        "message": "Welcome, Admin!"
    }

@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    admin_required(current_user)
    # Return user details with role name (assuming user.role is eagerly loaded or accessible)
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role_name": u.role.name if u.role else "Unknown"
        }
        for u in users
    ]

@router.get("/roles")
def get_all_roles(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    admin_required(current_user)
    roles = db.query(Role).all()
    return [{"id": r.id, "name": r.name, "description": r.description} for r in roles]

@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    admin_required(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_update.role_id is not None:
        user.role_id = user_update.role_id
        
    if user_update.password is not None:
        user.password_hash = hash_password(user_update.password)
        
    db.commit()
    return {"message": "User updated successfully"}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    admin_required(current_user)
    
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}