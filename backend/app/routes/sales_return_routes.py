from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.sales_return_model import SalesReturn
from app.schemas.sales_return_schema import SalesReturnCreate, SalesReturnResponse
from app.services.sales_return_service import SalesReturnService
from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/sales-returns",
    tags=["Sales Returns"]
)

@router.post("/", response_model=SalesReturnResponse)
def create_sales_return(
    return_data: SalesReturnCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return SalesReturnService.create_sales_return(db, return_data, current_user)

@router.get("/", response_model=List[SalesReturnResponse])
def get_sales_returns(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(SalesReturn).order_by(SalesReturn.return_date.desc()).all()

@router.get("/{return_id}", response_model=SalesReturnResponse)
def get_sales_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    sales_return = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not sales_return:
        raise HTTPException(status_code=404, detail="Sales Return not found")
    return sales_return
