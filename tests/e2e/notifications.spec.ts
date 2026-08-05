import { test, expect } from '@playwright/test';

test.describe('Notifications Feature E2E', () => {
  const FRONTEND_URL = 'http://localhost:5173';
  const API_URL = 'http://127.0.0.1:8000/api/v1';
  let productName = '';
  let sku = '';
  let productId = '';
  let uniqueId = '';

  test.beforeEach(async ({ request, page }, testInfo) => {
    uniqueId = Date.now().toString() + testInfo.workerIndex;
    
    // 1. Login via API
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      form: { username: 'paras@example.com', password: 'admin' }
    });
    const token = (await loginRes.json()).access_token;
    
    // 2. Create Supplier via API
    const supRes = await request.post(`${API_URL}/suppliers/`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { 
        name: `Notif Sup ${uniqueId}`, 
        phone: `9876${uniqueId}`.slice(-10), 
        email: `nsup${uniqueId}@ex.com` 
      }
    });
    const supplierId = (await supRes.json()).id;
    
    // 3. Create Category via API
    const catRes = await request.post(`${API_URL}/categories/`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Notif Cat ${uniqueId}`, description: 'Test' }
    });
    const categoryId = (await catRes.json()).id;
    
    // 4. Create Product via API with Quantity 10, Reorder Level 5
    productName = `Notif Prod ${uniqueId}`;
    sku = `NSKU-${uniqueId}`;
    const prodRes = await request.post(`${API_URL}/products/`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: productName,
        sku: sku,
        barcode: `BAR-${uniqueId}`,
        description: 'Test product for notification',
        cost_price: 10,
        selling_price: 20,
        reorder_level: 5,
        quantity: 10,
        category_id: categoryId,
        supplier_id: supplierId
      }
    });
    productId = (await prodRes.json()).id.toString();

    // 5. Navigate to login and authenticate in browser
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('input[type="email"]', 'paras@example.com');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    
    // Verify dashboard loaded
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should trigger and display a low stock notification when stock drops below reorder level', async ({ page }) => {
    // 1. Create Sales Order to reduce stock by 6 (New Stock = 4)
    await page.goto(`${FRONTEND_URL}/sales`);
    await page.getByRole('button', { name: 'New Order' }).click();
    
    // Find the select dropdown that contains the "Select Product" option
    await page.locator('select:has(option:has-text("Select Product"))').first().selectOption({ value: productId });
    await page.getByRole('spinbutton').first().fill('6');
    await page.getByRole('button', { name: 'Create Draft Order' }).click();
    
    // 2. Complete Sales Order (Deducts stock)
    // Open drawer
    await page.getByRole('row', { name: 'Walk-in Customer' }).first().click();
    await page.getByRole('button', { name: 'Pack Order' }).click();
    await page.getByPlaceholder('PKG-001').fill(`PKG-${uniqueId}`);
    await page.getByRole('button', { name: 'Confirm Packing' }).click();
    
    // Wait for the modal to fully close before trying to reopen the drawer
    await expect(page.getByRole('heading', { name: 'Pack Order' })).toBeHidden();
    
    // The drawer closes automatically after successful packing. We must click the row again to reopen it.
    await page.getByRole('row', { name: 'Walk-in Customer' }).first().click();

    await page.getByRole('button', { name: 'Ship Order (Deduct Stock)' }).click();
    await page.getByPlaceholder('FedEx, Delhivery...').fill('TestCarrier');
    await page.getByPlaceholder('TRK-987654321').fill(`TRK-${uniqueId}`);
    await page.getByRole('button', { name: 'Dispatch & Deduct Stock' }).click();

    // Wait for the Ship Order modal to close
    await expect(page.getByRole('heading', { name: 'Ship Order' })).toBeHidden();

    // 3. Verify Notification is triggered
    // Notifications poll every 60s, so we reload the page to fetch them instantly.
    await page.reload();

    // Wait for the red badge to appear on the notification bell indicating an unread notification
    const unreadBadge = page.locator('.bg-red-500');
    await expect(unreadBadge.first()).toBeVisible();
    
    // Click the bell button (parent of the badge)
    await unreadBadge.first().locator('..').click();

    // Verify "Low Stock Alert" appears
    await expect(page.getByText('Low Stock Alert').first()).toBeVisible();
    await expect(page.getByText(sku).first()).toBeVisible();

    // Click to mark as read
    await page.locator('li', { hasText: sku }).first().click();
  });
});
