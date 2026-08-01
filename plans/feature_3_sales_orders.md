# Feature 3 Implementation Plan: Sales Order Workflow

This plan details the transformation of the current `Sales` CRUD module into a full `Sales Order` workflow, aligning with the Zoho Inventory Order-to-Cash process.

## 1. Business Workflow
- **DRAFT**: Sales Order is created. No inventory is reserved or deducted.
- **CONFIRMED**: The order is validated.
- **PACKED**: Warehouse creates a `Package` for the items.
- **SHIPPED**: The package is dispatched. **This is the exact moment `adjust_stock()` is called** to deduct physical inventory.
- **DELIVERED**: Customer receives the items.
- **COMPLETED/CANCELLED**: End states.

## 2. Database Changes
We will create an Alembic migration to:
- Rename the `sales` table to `sales_orders`.
- Rename `sale_items` to `sales_order_items`.
- Add `status` (default: 'DRAFT') to `sales_orders`.
- Remove the legacy `customer_name` column (we now rely entirely on `customer_id` from Feature 1).
- Add new tables:
  - `packages`: Links to `sales_orders`. Tracks `package_number` and `status`.
  - `shipments`: Links to `packages`. Tracks `tracking_number`, `courier`, and `shipped_date`.

## 3. Backend API Changes
- **Rename Module**: Deprecate `sale_routes.py` in favor of `sales_order_routes.py`.
- **New Service**: Create `sales_order_service.py` to handle business logic.
- **Endpoints**:
  - `POST /sales-orders/` -> Creates DRAFT.
  - `PATCH /sales-orders/{id}/status` -> Transitions statuses.
  - `POST /sales-orders/{id}/pack` -> Creates a Package.
  - `POST /sales-orders/{id}/ship` -> Creates a Shipment and triggers physical stock deduction via `adjust_stock()`.

## 4. Relationship with Existing Modules
- Integrates seamlessly with the **Customers** module (requires `customer_id`).
- Interacts with **InventoryLogs** when the shipment is dispatched.
- Will serve as the foundation for the upcoming **Invoices** feature (Feature 4).

## 5. UI/Frontend Flow (Design.md Compliant)
- The UI will list Sales Orders with colorful status badges.
- Clicking an order opens a detail page (using `{colors.canvas-light}`).
- A timeline component will show the progression from DRAFT -> SHIPPED.
- "Fulfill Order" actions will trigger a slide-over drawer (`transform transition-transform`) to input package and courier details rather than a disruptive modal.

## 6. Verification Plan
- Unit tests (`test_sales_orders.py`) will be written to assert that stock does NOT decrease upon order creation, but DOES decrease when the `/ship` endpoint is called.
- End-to-end testing of the DRAFT -> SHIPPED pipeline.
