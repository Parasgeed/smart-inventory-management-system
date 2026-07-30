from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db

from app.models.product_model import Product

from app.schemas.product_schema import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductAdjustStock
)

from app.services.inventory_service import (
    adjust_stock,
    InsufficientStockError,
    ProductNotFoundError
)

from app.auth.dependencies import get_current_user
from app.auth.permissions import admin_required

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

@router.post("/", response_model=ProductResponse)
def create_product(product: ProductCreate,
                   db: Session = Depends(get_db),
                   current_user =Depends(get_current_user)
                   ):
    
    admin_required(current_user)

    existing_product = db.query(Product).filter(
        Product.sku == product.sku
    ).first()

    if existing_product:
        raise HTTPException(
            status_code=400,
            detail="Product with this SKU already exists"
        )
    
    new_product = Product(**product.model_dump())

    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    return new_product 
    
@router.get("/", response_model=list[ProductResponse])
def get_products(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Product).offset(skip).limit(limit).all()

@router.get("/{product_id}", response_model = ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()
    
    if not product:
        raise HTTPException(
            status_code = 404,
            detail = "Product not found"
        )
    
    return product

@router.put("/{product_id}" ,response_model = ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    admin_required(current_user)

    product = db.query(Product).filter(
        Product.id == product_id
        ).first()
    
    if not product:
        raise HTTPException(
            status_code = 404,
            detail = "Product not found"
        )
    
    update_data = product_data.model_dump(
        exclude_unset=True
    )

    # Enforce quantity rules: ignore direct stock modifications via general product update
    if "quantity" in update_data:
        del update_data["quantity"]

    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    
    return product


@router.post("/{product_id}/adjust", response_model=ProductResponse)
def adjust_product_stock(
    product_id: int,
    adjustment: ProductAdjustStock,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    admin_required(current_user)

    try:
        product = adjust_stock(
            db=db,
            product_id=product_id,
            quantity_changed=adjustment.quantity_changed,
            change_type=adjustment.change_type,
            reference_type="manual",
            reference_id=0,  # 0 for manual adjustments
            performed_by=current_user.id
        )
        db.commit()
        db.refresh(product)
        return product
    except ProductNotFoundError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except InsufficientStockError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    admin_required(current_user)

    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    db.delete(product)
    db.commit()

    return {
        "message": "Product deleted successfully"
    }