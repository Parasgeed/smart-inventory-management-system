import { test, expect } from '@playwright/test';

test.describe('Payments Feature E2E', () => {
  test('should navigate to payments page and verify its presence', async ({ page }) => {
    // 1. Mock authentication and initial data
    // Add a catch-all for any other API requests so they don't return 401 and cause a redirect
    await page.route('**/api/v1/**', async (route, request) => {
      const url = request.url();
      if (url.includes('/dashboard/summary')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' })
      });
    });

    await page.route('**/api/v1/payments/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            invoice_id: 101,
            payment_date: new Date().toISOString(),
            payment_method: 'Credit Card',
            payment_reference: 'TXN-12345',
            amount: 150.00
          }
        ])
      });
    });

    // 2. Inject a fake token into localStorage to bypass the login screen redirect
    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-jwt-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }));
    });

    // 3. Navigate to the app (Dashboard)
    await page.goto('http://localhost:5173/');

    // 4. Navigate to the newly created Payments page using the Sidebar link
    const paymentsLink = page.locator('nav').getByRole('link', { name: 'Payments' });
    await expect(paymentsLink).toBeVisible();
    await paymentsLink.click();

    // 5. Verify we are on the Payments page
    await expect(page).toHaveURL(/.*\/payments/);
    
    // Verify the page title/header
    const heading = page.getByRole('heading', { name: 'Payments' });
    await expect(heading).toBeVisible();

    // 6. Verify the mocked data table is visible
    const tableVisible = page.locator('table');
    await expect(tableVisible).toBeVisible();

    // Verify the mocked data is displayed
    await expect(page.getByText('TXN-12345')).toBeVisible();
    await expect(page.getByText('150.00')).toBeVisible();
  });
});
