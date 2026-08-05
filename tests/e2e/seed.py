import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"
unique_id = int(time.time())

# Login
resp = requests.post(f"{BASE_URL}/auth/login", data={"username": "paras@example.com", "password": "admin"})
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Create Supplier
sup_resp = requests.post(f"{BASE_URL}/suppliers/", json={
    "name": f"Notif Supplier {unique_id}",
    "phone": f"9876{str(unique_id)[-6:]}",
    "email": f"sup{unique_id}@example.com"
}, headers=headers)
supplier_id = sup_resp.json()["id"]

# Create Category
cat_resp = requests.post(f"{BASE_URL}/categories/", json={
    "name": f"Notif Category {unique_id}",
    "description": "Test"
}, headers=headers)
category_id = cat_resp.json()["id"]

# Create Product
prod_resp = requests.post(f"{BASE_URL}/products/", json={
    "name": f"Notif Product {unique_id}",
    "sku": f"NSKU-{unique_id}",
    "barcode": f"BAR-{unique_id}",
    "description": "Test product",
    "cost_price": 10,
    "selling_price": 20,
    "reorder_level": 5,
    "quantity": 10,
    "category_id": category_id,
    "supplier_id": supplier_id
}, headers=headers)
product = prod_resp.json()

print(f"PRODUCT_ID={product['id']}")
print(f"PRODUCT_NAME={product['name']}")
print(f"PRODUCT_SKU={product['sku']}")
