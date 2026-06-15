from app.auth.auth import (
    create_access_token,
    verify_token
)

token = create_access_token(
    {"sub": "admin@example.com"}
)

print("Token:", token)

payload = verify_token(token)

print("Payload:", payload)