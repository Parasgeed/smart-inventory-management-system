from pydantic import BaseModel, Field


class RoleCreate(BaseModel):
    role_name: str = Field(
        min_length=2,
        max_length=50
    )

    description: str | None = None


class RoleResponse(BaseModel):
    id: int
    role_name: str
    description: str | None

    class Config:
        from_attributes = True