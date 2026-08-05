from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user_model import User
from app.schemas.search_schema import SearchResponse
from app.services.search_service import SearchService


router = APIRouter(
    prefix="/search",
    tags=["Search"]
)

@router.get("", response_model=SearchResponse)
def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Perform a global search across products, categories, suppliers, customers, and orders.
    """
    results = SearchService.global_search(db=db, query=q)
    return SearchResponse(results=results)
