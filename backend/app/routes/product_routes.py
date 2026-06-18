from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db

from app.models.product_model import Product

from app.schemas.product_schema import (
    ProductCreate,
    ProductUpdate,
    ProductResponse
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
    
@router.get("/" , response_model = list[ProductResponse])
def get_products(
        db: Session = Depends(get_db),
        current_user =Depends(get_current_user)
    ):

    products = db.query(Product).all()
    return products

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

    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    
    return product

@router.delete("/product_id")
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
