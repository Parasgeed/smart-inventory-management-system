import { test, expect } from '@playwright/test';

test.describe('Invoice Management E2E Workflow', () => {
  const FRONTEND_URL = 'http://localhost:5173';
  const uniqueId = Date.now();
  const pkgNumber = `PKG-${uniqueId}`;
  const txnId = `TXN-${uniqueId}`;

  test.beforeEach(async ({ page }) => {
    // Navigate to login and authenticate
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('input[type="email"]', 'paras@example.com');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    
    // Verify dashboard loaded
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('End-to-End Invoice Generation & Payment Workflow', async ({ page }) => {
    // 1. Create a Sales Order
    await page.goto(`${FRONTEND_URL}/sales`);
    await page.getByRole('button', { name: 'New Order' }).click();
    
    // Select the first product available in the dropdown
    // Wait for the modal and select
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Create Draft Order' }).click();

    // 2. Open the created order (first row in the table)
    await page.getByRole('row').nth(1).click(); // Header is 0, first item is 1
    
    // 3. Pack Order
    await page.getByRole('button', { name: 'Pack Order' }).click();
    await page.getByPlaceholder('PKG-001').fill(pkgNumber);
    await page.getByRole('button', { name: 'Confirm Packing' }).click();
    
    // 4. Ship Order
    await page.getByRole('button', { name: 'Ship Order' }).click();
    await page.getByPlaceholder('FedEx, Delhivery...').fill('FedEx');
    await page.getByPlaceholder('TRK-987654321').fill('TRK-12345');
    await page.getByRole('button', { name: 'Dispatch & Deduct Stock' }).click();

    // Re-open the drawer to generate invoice
    await page.getByRole('row').nth(1).click();
    
    // 5. Generate Invoice
    await page.getByRole('button', { name: 'Generate Invoice' }).click();
    
    // This redirects to the Invoice Page (/invoices/id)
    await expect(page).toHaveURL(/\/invoices\/\d+/);
    await expect(page.getByText('DRAFT')).toBeVisible();

    // 6. Send Invoice
    await page.getByText('Send Invoice').click();
    await expect(page.getByText('SENT')).toBeVisible();

    // 7. Record Payment
    await page.getByText('Record Payment').click();
    
    // In the payment modal, fill the transaction ID and record
    await page.getByPlaceholder('Txn ID').fill(txnId);
    
    // There might be two 'Record Payment' texts, get the button inside the dialog
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Record Payment' }).click();

    // 8. Verify Status is PAID
    await expect(page.getByText('PAID')).toBeVisible();
  });
});
