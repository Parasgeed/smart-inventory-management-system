from pydantic import BaseModel, Field, ConfigDict


class ProductCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=255
    )
    description: str | None = None
    sku: str = Field(
        min_length=2,
        max_length=100
    )
    barcode: str | None = None
    quantity: int = Field(
        ge=0
    )
    cost_price: float = Field(
        ge=0
    )
    selling_price: float = Field(
        ge=0
    )
    reorder_level: int = Field(
        ge=0
    )
    supplier_id: int
    category_id: int

class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    barcode: str | None = None
    quantity: int | None = Field(default=None, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    selling_price: float | None = Field(default=None, ge=0)
    reorder_level: int | None = Field(default=None, ge=0)
    supplier_id: int | None = None
    category_id: int | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    description: str | None
    sku: str
    barcode: str | None
    quantity: int
    cost_price: float
    selling_price: float
    reorder_level: int
    supplier_id: int
    category_id: int

model_config = ConfigDict(
    from_attributes=True
)