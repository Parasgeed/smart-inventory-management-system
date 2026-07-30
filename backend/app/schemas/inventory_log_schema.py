from pydantic import BaseModel, ConfigDict
from datetime import datetime


class InventoryLogResponse(BaseModel):
    id: int
    product_id: int
    performed_by: int | None = None  # null for rows created before this column existed
    change_type: str
    reference_type: str | None
    reference_id: int | None
    quantity_changed: int
    previous_quantity: int
    new_quantity: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)