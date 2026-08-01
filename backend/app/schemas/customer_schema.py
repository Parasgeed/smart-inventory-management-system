from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class CustomerBase(BaseModel):
    name: str = Field(..., max_length=100)
    company_name: Optional[str] = Field(None, max_length=150)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    gst_number: Optional[str] = Field(None, max_length=50)
    
    billing_address: Optional[str] = Field(None, max_length=255)
    shipping_address: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    
    is_active: bool = True

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    company_name: Optional[str] = Field(None, max_length=150)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    gst_number: Optional[str] = Field(None, max_length=50)
    
    billing_address: Optional[str] = Field(None, max_length=255)
    shipping_address: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    
    is_active: Optional[bool] = None

class CustomerResponse(CustomerBase):
    id: int
    customer_code: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CustomerPaginatedResponse(BaseModel):
    total: int
    page: int
    size: int
    items: List[CustomerResponse]
