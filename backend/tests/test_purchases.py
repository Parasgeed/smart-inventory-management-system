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
    # Mocking DB session
    mock_db = MagicMock()
    
    # Mock supplier query
    mock_supplier = MagicMock()
    mock_supplier.id = 1
    
    # Mock product query
    mock_product = MagicMock()
    mock_product.id = 1
    mock_product.cost_price = Decimal("100.00")
    mock_product.quantity = 10
    
    # Setup mock query chain
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.with_for_update.return_value = mock_query
    
    # Side effect to return supplier then product then product for adjust_stock
    def mock_first_side_effect():
        pass
        
    mock_query.first.side_effect = [mock_supplier, mock_product, mock_product]
    
    def mock_add_side_effect(obj):
        pass
    
    def mock_flush_side_effect():
        pass
        
    def mock_refresh_side_effect(obj):
        obj.id = 1
        obj.status = "PENDING"
        
        # We need to simulate the back_populates relationship for purchase_items
        if hasattr(obj, "po_number"):
            # Mock purchase item
            pi = MagicMock()
            pi.id = 1
            pi.product_id = 1
            pi.quantity = 2
            pi.unit_price = Decimal("100.00")
            pi.subtotal = Decimal("200.00")
            obj.purchase_items = [pi]
            
    mock_db.add.side_effect = mock_add_side_effect
    mock_db.flush.side_effect = mock_flush_side_effect
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
                "quantity": 2,
                "unit_price": 100.0
            }
        ]
    }
    
    # Calculation expected:
    # Subtotal: 2 * 100 = 200
    # Discount (5%): 10
    # Discounted Subtotal: 190
    # Tax (10%): 19
    # Shipping: 50
    # Total = 190 + 19 + 50 = 259
    
    response = client.post("/purchases/", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert float(data["total_amount"]) == 259.0
    assert data["po_number"] == "PO-TEST-001"
    
    # Reset overrides
    app.dependency_overrides.pop(get_db)
