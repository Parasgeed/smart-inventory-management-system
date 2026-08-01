import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.database.database import get_db
import datetime

client = TestClient(app)

def test_create_customer():
    mock_db = MagicMock()
    
    # Mock for count to generate customer_code
    mock_query_count = MagicMock()
    mock_query_count.count.return_value = 0
    mock_db.query.return_value = mock_query_count
    
    def mock_add_side_effect(obj):
        pass
        
    def mock_refresh_side_effect(obj):
        obj.id = 1
        obj.created_at = datetime.datetime.now(datetime.timezone.utc)
        obj.updated_at = datetime.datetime.now(datetime.timezone.utc)
    
    mock_db.add.side_effect = mock_add_side_effect
    mock_db.refresh.side_effect = mock_refresh_side_effect
    mock_db.commit = MagicMock()
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    payload = {
        "name": "Acme Corp",
        "company_name": "Acme Corporation",
        "email": "contact@acme.com",
        "phone": "1234567890",
        "is_active": True
    }
    
    response = client.post("/api/v1/customers/", json=payload)
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Acme Corp"
    assert data["customer_code"] == "CUST-0001"
    
    app.dependency_overrides.pop(get_db)

def test_soft_delete_customer_without_sales():
    mock_db = MagicMock()
    
    mock_customer = MagicMock()
    mock_customer.id = 1
    mock_customer.customer_code = "CUST-0001"
    mock_customer.name = "Test"
    mock_customer.company_name = "Test Inc"
    mock_customer.email = "test@test.com"
    mock_customer.phone = "123"
    mock_customer.gst_number = "123"
    mock_customer.billing_address = "123"
    mock_customer.shipping_address = "123"
    mock_customer.city = "Test"
    mock_customer.state = "Test"
    mock_customer.country = "Test"
    mock_customer.postal_code = "123"
    mock_customer.is_active = True
    mock_customer.created_at = datetime.datetime.now(datetime.timezone.utc)
    mock_customer.updated_at = datetime.datetime.now(datetime.timezone.utc)
    
    def mock_query_side_effect(model):
        mock_query = MagicMock()
        if model.__name__ == "Customer":
            mock_query.filter.return_value.first.return_value = mock_customer
        elif model.__name__ == "Sale":
            mock_query.filter.return_value.count.return_value = 0
        return mock_query
        
    mock_db.query.side_effect = mock_query_side_effect
    mock_db.refresh.side_effect = lambda obj: None
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.delete("/api/v1/customers/1")
    assert response.status_code == 200
    # is_active should be set to False
    assert mock_customer.is_active is False
    
    app.dependency_overrides.pop(get_db)

def test_soft_delete_customer_with_sales():
    mock_db = MagicMock()
    
    mock_customer = MagicMock()
    mock_customer.id = 1
    mock_customer.customer_code = "CUST-0001"
    mock_customer.name = "Test"
    mock_customer.company_name = "Test Inc"
    mock_customer.email = "test@test.com"
    mock_customer.phone = "123"
    mock_customer.gst_number = "123"
    mock_customer.billing_address = "123"
    mock_customer.shipping_address = "123"
    mock_customer.city = "Test"
    mock_customer.state = "Test"
    mock_customer.country = "Test"
    mock_customer.postal_code = "123"
    mock_customer.is_active = True
    mock_customer.created_at = datetime.datetime.now(datetime.timezone.utc)
    mock_customer.updated_at = datetime.datetime.now(datetime.timezone.utc)
    
    def mock_query_side_effect(model):
        mock_query = MagicMock()
        if model.__name__ == "Customer":
            mock_query.filter.return_value.first.return_value = mock_customer
        elif model.__name__ == "Sale":
            mock_query.filter.return_value.count.return_value = 1  # Customer has 1 sale
        return mock_query
        
    mock_db.query.side_effect = mock_query_side_effect
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.delete("/api/v1/customers/1")
    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot delete customer with associated sales."
    
    app.dependency_overrides.pop(get_db)
