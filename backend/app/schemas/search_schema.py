from pydantic import BaseModel
from typing import List, Optional

class SearchResultItem(BaseModel):
    id: int
    type: str  # e.g., product, category, supplier, customer, sales_order, purchase_order
    title: str
    subtitle: Optional[str] = None
    link: str

class SearchResponse(BaseModel):
    results: List[SearchResultItem]
