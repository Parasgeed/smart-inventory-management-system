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

def test_purchase_calculation_logic():
    mock_db = MagicMock()
    
    mock_supplier = MagicMock()
    mock_supplier.id = 1
    
    mock_product = MagicMock()
    mock_product.id = 1
    mock_product.cost_price = Decimal("100.00")
    
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    
    # Side effect: first call is supplier, second is product
    mock_query.first.side_effect = [mock_supplier, mock_product]
    
    def mock_refresh_side_effect(obj):
        obj.id = 1
        obj.status = "DRAFT"
        if hasattr(obj, "po_number"):
            pi = MagicMock()
            pi.id = 1
            pi.product_id = 1
            pi.ordered_quantity = 2
            pi.received_quantity = 0
            pi.remaining_quantity = 2
            pi.unit_price = Decimal("100.00")
            pi.subtotal = Decimal("200.00")
            obj.purchase_items = [pi]
            
    mock_db.add.side_effect = lambda obj: None
    mock_db.flush.side_effect = lambda: None
    mock_db.refresh.side_effect = mock_refresh_side_effect
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    payload = {
        "po_number": "PO-TEST-001",
        "supplier_id": 1,
        "order_date": datetime.datetime.now().isoformat(),
        "tax_rate": 10.0,
        "discount_rate": 5.0,
        "shipping_charges": 50.0,
        "items": [
            {
                "product_id": 1,
                "ordered_quantity": 2,
                "unit_price": 100.0
            }
        ]
    }
    
    response = client.post("/api/v1/purchases/", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert float(data["total_amount"]) == 259.0
    assert data["po_number"] == "PO-TEST-001"
    assert data["status"] == "DRAFT"
    
    app.dependency_overrides.pop(get_db)


def test_receive_purchase_items():
    mock_db = MagicMock()
    
    mock_purchase = MagicMock()
    mock_purchase.id = 1
    mock_purchase.po_number = "PO-001"
    mock_purchase.supplier_id = 1
    mock_purchase.user_id = 1
    mock_purchase.order_date = datetime.datetime.now(datetime.timezone.utc)
    mock_purchase.expected_delivery_date = None
    mock_purchase.tax_rate = Decimal("0")
    mock_purchase.discount_rate = Decimal("0")
    mock_purchase.shipping_charges = Decimal("0")
    mock_purchase.payment_terms = "Net 30"
    mock_purchase.delivery_address = "HQ"
    mock_purchase.total_amount = Decimal("100.00")
    mock_purchase.status = "ISSUED"
    mock_purchase.notes = None
    
    mock_pi = MagicMock()
    mock_pi.id = 1
    mock_pi.product_id = 1
    mock_pi.ordered_quantity = 100
    mock_pi.received_quantity = 40
    mock_pi.remaining_quantity = 60
    mock_pi.unit_price = Decimal("1.00")
    mock_pi.subtotal = Decimal("100.00")
    mock_purchase.purchase_items = [mock_pi]
    
    mock_product = MagicMock()
    mock_product.id = 1
    mock_product.quantity = 10
    
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    
    def first_side_effect():
        # A bit hacky: The first query is for Purchase, then for Product in adjust_stock
        yield mock_purchase
        yield mock_product
        
    mock_query.first.side_effect = first_side_effect()
    mock_query.with_for_update.return_value = mock_query
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    payload = {
        "items": [
            {
                "product_id": 1,
                "quantity_received": 20
            }
        ]
    }
    
    response = client.post("/api/v1/purchases/1/receive", json=payload)
    
    assert response.status_code == 200
    assert mock_pi.received_quantity == 60
    assert mock_pi.remaining_quantity == 40
    assert mock_purchase.status == "PARTIALLY_RECEIVED"
    
    app.dependency_overrides.pop(get_db)
