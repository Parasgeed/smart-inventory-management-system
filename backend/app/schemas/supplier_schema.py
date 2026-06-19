from pydantic import BaseModel, EmailStr, Field, ConfigDict


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


class SupplierUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    gst_number: str | None = None
    is_active: bool | None = None

class SupplierResponse(BaseModel):
    id: int
    name: str
    email: str | None
    phone: str
    address: str | None
    gst_number: str | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)