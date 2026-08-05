from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.purchase_return_model import PurchaseReturn
from app.schemas.purchase_return_schema import PurchaseReturnCreate, PurchaseReturnResponse
from app.services.purchase_return_service import PurchaseReturnService
from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/purchase-returns",
    tags=["Purchase Returns"]
)

@router.post("/", response_model=PurchaseReturnResponse)
def create_purchase_return(
    return_data: PurchaseReturnCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return PurchaseReturnService.create_purchase_return(db, return_data, current_user)

@router.get("/", response_model=List[PurchaseReturnResponse])
def get_purchase_returns(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(PurchaseReturn).order_by(PurchaseReturn.return_date.desc()).all()

@router.get("/{return_id}", response_model=PurchaseReturnResponse)
def get_purchase_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    purchase_return = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase Return not found")
    return purchase_return
