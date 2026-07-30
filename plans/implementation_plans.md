# Implementation Plans & Architecture

## System Overview
The Smart Inventory Management System is built using a modern, decoupled architecture:
- **Frontend**: React 19 + Vite 8 + Tailwind CSS 3
- **Backend**: Python FastAPI + SQLAlchemy + PostgreSQL (Alembic for migrations)
- **API Routing**: Backend endpoints are strictly prefixed with `/api/v1` to prevent route collision with the Vite SPA dev server.

## Backend Core Principles
1. **Inventory Adjustments**: All stock mutations happen through `inventory_service.adjust_stock()`. Routes never manipulate `product.quantity` directly. This ensures the `InventoryLog` audit table stays 100% accurate.
2. **Atomic Transactions**: `adjust_stock()` does NOT commit. The route owns the `db.commit()` boundary to ensure that multiple line items in a purchase or sale succeed or fail entirely together.
3. **Concurrency**: Row-level locking (`SELECT ... FOR UPDATE`) is heavily utilized during stock adjustments to prevent race conditions on concurrent requests.
4. **Data Types**: All monetary values use `Numeric(10,2)` in PostgreSQL and `Decimal` in Python. Floating point numbers are strictly avoided for financial data.

## Current Technical Debts / Next Steps
- Implement pagination controls for `/sales/` and `/purchases/` on the backend (currently only supports `?limit=N`).
- Implement proper testing suite (only manual JWT test exists currently).
- Setup CI/CD pipeline and Dockerization for deployment.
