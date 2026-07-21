import { expect, request, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:5000/api';
const password = 'password123';

async function login(email: string) {
  const api = await request.newContext();
  let loginResponse;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      loginResponse = await api.post(`${apiBaseUrl}/auth/login`, { data: { email, password } });
      if (loginResponse.ok()) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  expect(loginResponse?.ok()).toBeTruthy();

  const csrfResponse = await api.get(`${apiBaseUrl}/security/csrf-token`);
  expect(csrfResponse.ok()).toBeTruthy();
  const csrfToken = (await csrfResponse.json()).token;
  return { api, csrfToken };
}

test.describe('waiting list flow', () => {
  test('manager can add, notify, seat and cancel waiting-list guests', async ({ page }) => {
    const manager = await login('manager@savannabistro.com');
    const suffix = Date.now().toString().slice(-6);

    const tableResponse = await manager.api.post(`${apiBaseUrl}/tables`, {
      headers: { 'x-csrf-token': manager.csrfToken },
      data: {
        name: `E2E Wait ${suffix}`,
        code: `E2EWL${suffix}`,
        capacity: 4,
        shape: 'ROUND',
      },
    });
    expect(tableResponse.ok()).toBeTruthy();
    const table = (await tableResponse.json()).data;

    const createResponse = await manager.api.post(`${apiBaseUrl}/waiting-list`, {
      headers: { 'x-csrf-token': manager.csrfToken },
      data: {
        customerName: `Waiting Guest ${suffix}`,
        phone: `+250788${suffix}`,
        partySize: 3,
        estimatedWaitMinutes: 15,
        priority: 3,
        notes: 'E2E waiting list flow',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const entry = (await createResponse.json()).data;
    expect(entry.status).toBe('WAITING');
    expect(entry.priority).toBe(3);

    const duplicateResponse = await manager.api.post(`${apiBaseUrl}/waiting-list`, {
      headers: { 'x-csrf-token': manager.csrfToken },
      data: {
        customerName: `Waiting Guest ${suffix}`,
        phone: `+250788${suffix}`,
        partySize: 3,
      },
    });
    expect(duplicateResponse.status()).toBe(400);

    const notifyResponse = await manager.api.post(`${apiBaseUrl}/waiting-list/${entry.id}/notify`, {
      headers: { 'x-csrf-token': manager.csrfToken },
    });
    expect(notifyResponse.ok()).toBeTruthy();
    expect((await notifyResponse.json()).data.status).toBe('NOTIFIED');

    const seatResponse = await manager.api.post(`${apiBaseUrl}/waiting-list/${entry.id}/seat`, {
      headers: { 'x-csrf-token': manager.csrfToken },
      data: { tableId: table.id, createOrder: true, guestCount: 3 },
    });
    expect(seatResponse.ok()).toBeTruthy();
    const seated = (await seatResponse.json()).data;
    expect(seated.status).toBe('SEATED');
    expect(seated.tableId).toBe(table.id);
    expect(seated.orderId).toBeTruthy();

    const cancelCreate = await manager.api.post(`${apiBaseUrl}/waiting-list`, {
      headers: { 'x-csrf-token': manager.csrfToken },
      data: {
        customerName: `Cancel Guest ${suffix}`,
        phone: `+250799${suffix}`,
        partySize: 2,
      },
    });
    expect(cancelCreate.ok()).toBeTruthy();
    const cancelEntry = (await cancelCreate.json()).data;

    const cancelResponse = await manager.api.post(`${apiBaseUrl}/waiting-list/${cancelEntry.id}/cancel`, {
      headers: { 'x-csrf-token': manager.csrfToken },
    });
    expect(cancelResponse.ok()).toBeTruthy();
    expect((await cancelResponse.json()).data.status).toBe('CANCELLED');

    await page.goto('/login');
    await page.getByLabel('Email address').fill('manager@savannabistro.com');
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/waiting-list');
    await expect(page.getByRole('heading', { name: /waiting list/i })).toBeVisible();
    await page.getByRole('combobox').selectOption('CANCELLED');
    await expect(page.getByText(`Cancel Guest ${suffix}`)).toBeVisible();

    await manager.api.dispose();
  });

  test('stock keeper cannot access waiting list', async () => {
    const stock = await login('stock@savannabistro.com');
    const response = await stock.api.get(`${apiBaseUrl}/waiting-list`);
    expect(response.status()).toBe(403);
    await stock.api.dispose();
  });
});
