from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=30,
        pattern="^[a-zA-Z0-9_]+$"
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=100
    )

    role_id: int


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role_id: int
    is_active: bool

    class Config:
        from_attributes = True