from pydantic import BaseModel, EmailStr, Field


class SupplierCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=255
    )

    email: EmailStr | None = None

    phone: str = Field(
        min_length=10,
        max_length=20
    )

    address: str | None = None

    gst_number: str | None = None


class SupplierResponse(BaseModel):
    id: int
    name: str
    email: str | None
    phone: str
    address: str | None
    gst_number: str | None
    is_active: bool

    class Config:
        from_attributes = True