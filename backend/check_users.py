import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

DATABASE_URL = "postgresql://postgres:paras%40123@localhost:5432/inventory-management"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def main():
    db = SessionLocal()
    from sqlalchemy import text
    hashed_password = pwd_context.hash("admin")
    db.execute(text("UPDATE users SET hashed_password = :hp WHERE username = 'paras';"), {"hp": hashed_password})
    db.commit()
    print("Password reset to 'admin' for paras")
    db.close()

if __name__ == "__main__":
    main()
