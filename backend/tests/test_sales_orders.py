import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.database.database import get_db
from app.auth.dependencies import get_current_user
from decimal import Decimal
import datetime

# Mock User
class MockUser:
    id = 1
    class Role:
        name = "admin"
    role = Role()

def override_get_current_user():
    return MockUser()

app.dependency_overrides[get_current_user] = override_get_current_user
client = TestClient(app)

def test_create_sales_order():
    mock_db = MagicMock()
    
    mock_product = MagicMock()
    mock_product.id = 1
    mock_product.cost_price = Decimal("10.00")
    
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    
    def mock_refresh_side_effect(obj):
        obj.id = 1
        obj.status = "DRAFT"
        obj.sale_date = datetime.datetime.now()
        obj.user_id = 1
        obj.customer_id = 1
        obj.payment_method = "Credit Card"
        obj.total_amount = Decimal("150.00")
        obj.sales_order_items = []
        obj.packages = []
            
    mock_db.add.side_effect = lambda obj: None
    mock_db.commit.side_effect = lambda: None
    mock_db.refresh.side_effect = mock_refresh_side_effect
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    payload = {
        "customer_id": 1,
        "payment_method": "Credit Card",
        "items": [
            {
                "product_id": 1,
                "quantity": 10,
                "unit_price": "15.00"
            }
        ]
    }
    
    response = client.post("/api/v1/sales-orders/", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert float(data["total_amount"]) == 150.0
    assert data["status"] == "DRAFT"
    
    app.dependency_overrides.pop(get_db, None)

def test_pack_order():
    mock_db = MagicMock()
    
    mock_order = MagicMock()
    mock_order.id = 1
    mock_order.status = "DRAFT"
    
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_order
    
    def mock_refresh_side_effect(obj):
        obj.id = 1
        obj.sales_order_id = 1
        obj.package_number = "PKG-001"
        obj.status = "PACKED"
        obj.created_at = datetime.datetime.now()
        obj.shipments = []
            
    mock_db.add.side_effect = lambda obj: None
    mock_db.commit.side_effect = lambda: None
    mock_db.refresh.side_effect = mock_refresh_side_effect
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    payload = {
        "package_number": "PKG-001"
    }
    
    response = client.post("/api/v1/sales-orders/1/pack", json=payload)
    
    assert response.status_code == 200
    assert mock_order.status == "PACKED"
    
    app.dependency_overrides.pop(get_db, None)

def test_ship_package():
    mock_db = MagicMock()
    
    mock_order_item = MagicMock()
    mock_order_item.product_id = 1
    mock_order_item.quantity = 5
    
    mock_order = MagicMock()
    mock_order.id = 1
    mock_order.status = "PACKED"
    mock_order.sales_order_items = [mock_order_item]
    
    mock_package = MagicMock()
    mock_package.id = 1
    mock_package.status = "PACKED"
    mock_package.sales_order = mock_order
    
    mock_product = MagicMock()
    mock_product.id = 1
    mock_product.quantity = 100
    
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    
    def first_side_effect():
        yield mock_package
        yield mock_product  # for adjust_stock inside InventoryService
        
    mock_query.first.side_effect = first_side_effect()
    mock_query.with_for_update.return_value = mock_query
    
    def mock_refresh_side_effect(obj):
        obj.id = 1
        obj.package_id = 1
        obj.tracking_number = "TRK-001"
        obj.courier = "FedEx"
        obj.shipped_date = datetime.datetime.now()
            
    mock_db.add.side_effect = lambda obj: None
    mock_db.commit.side_effect = lambda: None
    mock_db.refresh.side_effect = mock_refresh_side_effect
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    payload = {
        "tracking_number": "TRK-001",
        "courier": "FedEx"
    }
    
    response = client.post("/api/v1/sales-orders/packages/1/ship", json=payload)
    
    assert response.status_code == 200
    assert mock_package.status == "SHIPPED"
    assert mock_order.status == "SHIPPED"
    
    # Check if stock deduction happened correctly via adjust_stock
    assert mock_product.quantity == 95  # 100 - 5
    
    app.dependency_overrides.pop(get_db, None)
