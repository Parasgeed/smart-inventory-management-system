from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.supplier_model import Supplier

from app.schemas.supplier_schema import SupplierCreate, SupplierUpdate, SupplierResponse

from app.auth.dependencies import get_current_user
from app.auth.permissions import admin_required

router = APIRouter(
    prefix="/suppliers",tags=["Suppliers"])

@router.post("/", response_model=SupplierResponse)
def create_supplier(
    supplier: SupplierCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    admin_required(current_user)

    existing_supplier = db.query(Supplier).filter(
        Supplier.phone == supplier.phone
    ).first()

    if existing_supplier:
        raise HTTPException(
            status_code=400,
            detail="Supplier already exists"
        )
    
    if supplier.email:
        existing_email = db.query(Supplier).filter(
        Supplier.email == supplier.email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )
    
    if supplier.gst_number:
        existing_gst = db.query(Supplier).filter(
        Supplier.gst_number == supplier.gst_number
    ).first()

    if existing_gst:
        raise HTTPException(
            status_code=400,
            detail="GST number already exists"
        )

    new_supplier = Supplier(
        **supplier.model_dump()
    )

    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)

    return new_supplier


@router.get("/", response_model=list[SupplierResponse])
def get_suppliers(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Supplier).all()



@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id
    ).first()

    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found"
        )

    return supplier

@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int,
    supplier_data: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    admin_required(current_user)

    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id
    ).first()

    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found"
        )

    # Email validation
    if supplier_data.email:

        existing_email = db.query(Supplier).filter(
            Supplier.email == supplier_data.email,
            Supplier.id != supplier_id
        ).first()

        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="Email already exists"
            )

    # GST validation
    if supplier_data.gst_number:

        existing_gst = db.query(Supplier).filter(
            Supplier.gst_number == supplier_data.gst_number,
            Supplier.id != supplier_id
        ).first()

        if existing_gst:
            raise HTTPException(
                status_code=400,
                detail="GST number already exists"
            )

    # Phone validation
    if supplier_data.phone:

        existing_phone = db.query(Supplier).filter(
            Supplier.phone == supplier_data.phone,
            Supplier.id != supplier_id
        ).first()

        if existing_phone:
            raise HTTPException(
                status_code=400,
                detail="Phone number already exists"
            )

    update_data = supplier_data.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():
        setattr(supplier, key, value)

    db.commit()
    db.refresh(supplier)

    return supplier

@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    admin_required(current_user)

    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id
    ).first()

    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found"
        )

    db.delete(supplier)
    db.commit()

    return {
        "message": "Supplier deleted successfully"
    }