from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List

from app.models.product_model import Product
from app.models.category_model import Category
from app.models.supplier_model import Supplier
from app.models.customer_model import Customer
from app.models.invoice_model import Invoice
from app.models.purchase_model import Purchase
from app.models.sales_order_model import SalesOrder

from app.schemas.search_schema import SearchResultItem


class SearchService:
    @staticmethod
    def global_search(db: Session, query: str) -> List[SearchResultItem]:
        results: List[SearchResultItem] = []
        if not query or len(query) < 2:
            return results

        search_pattern = f"%{query}%"

        # Search Products
        products = db.query(Product).filter(
            or_(
                Product.name.ilike(search_pattern),
                Product.sku.ilike(search_pattern)
            )
        ).limit(5).all()
        for p in products:
            results.append(SearchResultItem(
                id=p.id,
                type="product",
                title=p.name,
                subtitle=f"SKU: {p.sku}",
                link="/products"
            ))

        # Search Categories
        categories = db.query(Category).filter(
            Category.name.ilike(search_pattern)
        ).limit(5).all()
        for c in categories:
            results.append(SearchResultItem(
                id=c.id,
                type="category",
                title=c.name,
                subtitle="Category",
                link="/products" # Categories are usually managed on products page
            ))

        # Search Suppliers
        suppliers = db.query(Supplier).filter(
            or_(
                Supplier.name.ilike(search_pattern),
                Supplier.email.ilike(search_pattern),
                Supplier.phone.ilike(search_pattern)
            )
        ).limit(5).all()
        for s in suppliers:
            results.append(SearchResultItem(
                id=s.id,
                type="supplier",
                title=s.name,
                subtitle=s.email or "Supplier",
                link="/suppliers"
            ))

        # Search Customers
        customers = db.query(Customer).filter(
            or_(
                Customer.name.ilike(search_pattern),
                Customer.company_name.ilike(search_pattern),
                Customer.email.ilike(search_pattern)
            )
        ).limit(5).all()
        for c in customers:
            results.append(SearchResultItem(
                id=c.id,
                type="customer",
                title=c.name or "Unknown Customer",
                subtitle=c.email or "Customer",
                link="/sales" # Customers usually managed in sales context
            ))

        # Search Invoices
        invoices = db.query(Invoice).filter(
            Invoice.invoice_number.ilike(search_pattern)
        ).limit(5).all()
        for i in invoices:
            results.append(SearchResultItem(
                id=i.id,
                type="invoice",
                title=i.invoice_number,
                subtitle=f"Status: {i.status}",
                link=f"/invoices/{i.id}"
            ))

        # Search Purchases (POs)
        purchases = db.query(Purchase).filter(
            Purchase.po_number.ilike(search_pattern)
        ).limit(5).all()
        for pu in purchases:
            results.append(SearchResultItem(
                id=pu.id,
                type="purchase",
                title=pu.po_number,
                subtitle=f"Status: {pu.status}",
                link="/purchases"
            ))

        return results
