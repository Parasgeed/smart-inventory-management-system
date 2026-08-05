from app.database.database import SessionLocal
from app.models.user_model import User
from app.auth.security import hash_password

db = SessionLocal()
user = db.query(User).filter_by(username="paras").first()
if not user:
    user = db.query(User).first()

print("Found user:", user.email if user else "None")

if user:
    user.hashed_password = hash_password("paras@123")
    db.commit()
    print("Password reset for:", user.email)
db.close()
