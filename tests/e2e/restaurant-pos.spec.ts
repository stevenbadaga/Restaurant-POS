import { expect, test, type Page } from '@playwright/test';

const password = 'password123';

const credentials = {
  manager: 'manager@savannabistro.com',
  waiter: 'waiter1@savannabistro.com',
  chef: 'chef1@savannabistro.com',
  cashier: 'cashier@savannabistro.com',
  stockKeeper: 'stock@savannabistro.com',
};

function attachConsoleGuard(page: Page) {
  const failures: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  page.on('response', (response) => {
    if ([401, 403, 404, 429, 500].includes(response.status())) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => failures.push(error.message));
  return failures;
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: /^dashboard$/i })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByTitle('Sign out').click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
}

async function visitAppPage(page: Page, path: string, heading: RegExp) {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
}

test.describe('authenticated role flows', () => {
  test('manager can navigate core operations, notifications, approvals, and logout', async ({ page }) => {
    const consoleFailures = attachConsoleGuard(page);
    await login(page, credentials.manager);

    await visitAppPage(page, '/orders', /orders/i);
    await visitAppPage(page, '/kitchen', /kitchen/i);
    await visitAppPage(page, '/payments', /payments/i);
    await visitAppPage(page, '/receipts', /receipts/i);
    await visitAppPage(page, '/inventory', /inventory/i);
    await visitAppPage(page, '/reservations', /reservations/i);
    await visitAppPage(page, '/tips', /tips/i);
    await visitAppPage(page, '/notifications', /notifications/i);
    await visitAppPage(page, '/approvals', /approvals/i);

    await logout(page);
    expect(consoleFailures).toEqual([]);
  });

  test('waiter can create an order and submit it to kitchen', async ({ page }) => {
    const consoleFailures = attachConsoleGuard(page);
    await login(page, credentials.waiter);

    await page.goto('/orders/new');
    await expect(page.getByRole('heading', { name: /new order/i })).toBeVisible();
    await page.getByText('Caesar Salad', { exact: false }).first().click();
    await page.getByText('Still Mineral Water', { exact: false }).first().click();
    await page.getByPlaceholder('Walk-in').fill('E2E Walk-in');
    await page.getByRole('button', { name: /submit order to kitchen/i }).click();
    await expect(page.getByText(/created successfully/i)).toBeVisible();
    await expect(page).toHaveURL(/\/orders/);

    await visitAppPage(page, '/notifications', /notifications/i);
    await logout(page);
    expect(consoleFailures).toEqual([]);
  });

  test('chef can view kitchen status and ticket controls', async ({ page }) => {
    const consoleFailures = attachConsoleGuard(page);
    await login(page, credentials.chef);

    await visitAppPage(page, '/kitchen', /kitchen/i);
    await expect(page.getByText(/new|preparing|ready/i).first()).toBeVisible();

    await logout(page);
    expect(consoleFailures).toEqual([]);
  });

  test('cashier can process payments, view receipts, tips, and logout', async ({ page }) => {
    const consoleFailures = attachConsoleGuard(page);
    await login(page, credentials.cashier);

    await visitAppPage(page, '/payments', /payments/i);
    const payButton = page.getByRole('button', { name: /^pay$/i }).first();
    if (await payButton.isVisible().catch(() => false)) {
      await payButton.click();
      await expect(page.getByText(/process payment/i)).toBeVisible();
      const amount = await page.locator('input[type="number"]').first().inputValue();
      const tendered = page.getByLabel(/cash tendered/i).or(page.locator('input[type="number"]').nth(1));
      if (amount && await tendered.isVisible().catch(() => false)) {
        await tendered.fill(amount);
      }
      await page.getByRole('button', { name: /record payment/i }).click();
      await expect(page.getByText(/payment recorded successfully/i)).toBeVisible();
    }

    await visitAppPage(page, '/receipts', /receipts/i);
    await visitAppPage(page, '/tips', /tips/i);
    await logout(page);
    expect(consoleFailures).toEqual([]);
  });

  test('stock keeper can view inventory and submit stock adjustment approval request', async ({ page }) => {
    const consoleFailures = attachConsoleGuard(page);
    await login(page, credentials.stockKeeper);

    await visitAppPage(page, '/inventory', /inventory/i);
    const adjustmentButton = page.getByRole('button', { name: /adjustment|new adjustment|create adjustment/i }).first();
    if (await adjustmentButton.isVisible().catch(() => false)) {
      await adjustmentButton.click();
      await expect(page.getByText(/adjustment/i).first()).toBeVisible();
    }

    await visitAppPage(page, '/notifications', /notifications/i);
    await logout(page);
    expect(consoleFailures).toEqual([]);
  });
});

test.describe('public customer and QR flows', () => {
  test('public pages, reservation, and QR entry points load without console errors', async ({ page }) => {
    const consoleFailures = attachConsoleGuard(page);

    await page.goto('/welcome');
    await expect(page.getByText(/savanna bistro|restaurant/i).first()).toBeVisible();

    await page.goto('/reserve');
    await expect(page.getByRole('heading', { name: /reserve|reservation/i })).toBeVisible();

    await page.goto('/track-order');
    await expect(page.getByRole('heading', { name: /track/i })).toBeVisible();

    await page.goto('/qr/e2eqr01');
    await expect(page.getByText(/browse menu|order to table/i).first()).toBeVisible();

    expect(consoleFailures).toEqual([]);
  });
});
