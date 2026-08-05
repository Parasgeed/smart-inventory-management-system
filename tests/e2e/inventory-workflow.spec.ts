import { test, expect } from '@playwright/test';

test.describe('Inventory Management E2E Workflow', () => {
  const FRONTEND_URL = 'http://localhost:5173';
  const uniqueId = Date.now();
  const supplierName = `E2E Supplier ${uniqueId}`;
  const categoryName = `E2E Category ${uniqueId}`;
  const productName = `E2E Product ${uniqueId}`;
  const sku = `SKU-${uniqueId}`;

  test.beforeEach(async ({ page }) => {
    // Navigate to login and authenticate
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('input[type="email"]', 'paras@example.com');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    
    // Verify dashboard loaded
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('End-to-End Inventory Workflow', async ({ page }) => {
    // 1. Create Supplier
    await page.goto(`${FRONTEND_URL}/suppliers`);
    await page.click('button:has-text("Add Supplier")');
    await page.fill('input[placeholder*="Company or supplier name"]', supplierName);
    await page.fill('input[placeholder*="Contact Person"]', 'John Doe');
    await page.fill('input[type="email"]', `supplier${uniqueId}@e2e.test`);
    await page.fill('input[placeholder*="Phone Number"]', '1234567890');
    await page.fill('input[placeholder*="Address / Location"]', '123 Test St');
    await page.click('button:has-text("Save Supplier")');
    await expect(page.getByText(supplierName)).toBeVisible();

    // 2. Add Category (Via Products Page)
    await page.goto(`${FRONTEND_URL}/products`);
    await page.click('button:has-text("Add Product")');
    await page.fill('input[placeholder="New Category Name"]', categoryName);
    await page.click('button:has-text("Add")'); // Inline add category

    // 3. Create Product
    await page.fill('input[placeholder*="Product Name"]', productName);
    await page.fill('input[placeholder*="SKU"]', sku);
    await page.selectOption('select', { label: categoryName });
    // In actual implementation we need to use getByRole or similar if multiple selects exist
    await page.getByRole('combobox').nth(1).selectOption({ label: categoryName });
    await page.getByRole('combobox').nth(2).selectOption({ label: supplierName });
    await page.fill('input[placeholder*="Cost Price"]', '100');
    await page.fill('input[placeholder*="Selling Price"]', '150');
    await page.fill('input[placeholder*="Starting Stock Quantity"]', '10');
    await page.fill('input[placeholder*="Reorder Level"]', '5');
    await page.click('button:has-text("Save Product")');
    
    // Search and verify product
    await page.getByRole('textbox', { name: /search/i }).fill(sku);
    await expect(page.getByText(productName)).toBeVisible();

    // 4. Create Purchase Order
    await page.goto(`${FRONTEND_URL}/purchases`);
    await page.getByRole('button', { name: 'New Purchase' }).click();
    await page.getByRole('combobox').first().selectOption({ label: supplierName });
    await page.getByRole('button', { name: '+ Add Item' }).click();
    await page.getByRole('combobox').nth(1).selectOption({ label: `${productName} (SKU: ${sku})` });
    await page.getByRole('spinbutton').first().fill('50');
    await page.getByRole('button', { name: 'Create Draft Order' }).click();
    
    // Issue and Receive PO
    await page.getByRole('row', { name: supplierName }).first().click();
    await page.getByRole('button', { name: 'Issue PO' }).click();
    await page.getByRole('button', { name: 'Yes, Confirm' }).click();
    await page.getByRole('button', { name: 'Receive Stock' }).click();
    
    // Verify Inventory Increased (10 + 50 = 60)
    await page.goto(`${FRONTEND_URL}/products`);
    await page.getByRole('textbox', { name: /search/i }).fill(sku);
    await expect(page.getByText('60')).toBeVisible();

    // 5. Create Sales Order
    await page.goto(`${FRONTEND_URL}/sales`);
    await page.getByRole('button', { name: 'New Order' }).click();
    await page.getByRole('button', { name: '+ Add Product' }).click();
    await page.getByRole('combobox').nth(2).selectOption({ label: `${productName} (SKU: ${sku}, Qty: 60)` });
    await page.getByRole('spinbutton').first().fill('10');
    await page.getByRole('button', { name: 'Create Draft Order' }).click();
    
    // Complete/Ship Sales Order
    await page.getByRole('row', { name: 'Walk-in Customer' }).first().click();
    await page.getByRole('button', { name: 'Pack Order' }).click();
    await page.getByRole('textbox', { name: 'PKG-' }).fill('PKG-001');
    await page.getByRole('button', { name: 'Confirm Packing' }).click();
    
    await page.getByRole('button', { name: 'Ship Order (Deduct Stock)' }).click();
    await page.getByRole('textbox', { name: /FedEx/i }).fill('FedEx');
    await page.getByRole('textbox', { name: /TRK-/i }).fill('TRK-12345');
    await page.getByRole('button', { name: 'Dispatch & Deduct Stock' }).click();

    // Verify Inventory Decreased (60 - 10 = 50)
    await page.goto(`${FRONTEND_URL}/products`);
    await page.getByRole('textbox', { name: /search/i }).fill(sku);
    await expect(page.getByText('50')).toBeVisible();

    // 6. Check Reports
    await page.goto(`${FRONTEND_URL}/reports`);
    await page.getByRole('button', { name: 'Inventory Reports' }).click();
    await expect(page.getByRole('cell', { name: productName })).toBeVisible();
    await expect(page.getByRole('cell', { name: '50' })).toBeVisible();

    // 7. Check Dashboard
    await page.goto(`${FRONTEND_URL}/`);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('cell', { name: productName })).toBeVisible();
  });
});
