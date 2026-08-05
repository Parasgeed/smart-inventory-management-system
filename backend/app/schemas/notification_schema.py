from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NotificationBase(BaseModel):
    user_id: int
    type: str
    title: str
    message: str
    is_read: Optional[bool] = False
    reference_id: Optional[int] = None

class NotificationCreate(NotificationBase):
    pass

class NotificationUpdate(BaseModel):
    is_read: bool

class NotificationOut(NotificationBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True
