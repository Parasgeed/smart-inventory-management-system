from pydantic import BaseModel, Field, ConfigDict


class RoleCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=50
    )

    description: str | None = None


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = ConfigDict(from_attributes=True)