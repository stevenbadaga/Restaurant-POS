import { expect, request, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:5000/api';

test.describe('security controls', () => {
  test('representative protected routes reject unauthenticated requests', async () => {
    const api = await request.newContext();

    const protectedRoutes = [
      'auth/me',
      'orders',
      'payments',
      'receipts',
      'kitchen/tickets',
      'notifications',
      'inventory/items',
      'reservations',
      'tips',
      'reports/sales/overview',
      'staff',
      'approval-requests',
    ];

    for (const route of protectedRoutes) {
      const response = await api.get(`${apiBaseUrl}/${route}`);
      expect(response.status(), route).toBe(401);
    }

    await api.dispose();
  });

  test('state-changing protected routes require a valid CSRF token', async () => {
    const api = await request.newContext();

    const login = await api.post(`${apiBaseUrl}/auth/login`, {
      data: { email: 'manager@savannabistro.com', password: 'password123' },
    });
    expect(login.ok()).toBeTruthy();

    const missingToken = await api.post(`${apiBaseUrl}/orders`, { data: {} });
    expect(missingToken.status()).toBe(403);

    const badToken = await api.post(`${apiBaseUrl}/orders`, {
      headers: { 'x-csrf-token': 'invalid' },
      data: {},
    });
    expect(badToken.status()).toBe(403);

    const csrf = await api.get(`${apiBaseUrl}/security/csrf-token`);
    expect(csrf.ok()).toBeTruthy();
    const token = (await csrf.json()).token;

    const validToken = await api.post(`${apiBaseUrl}/orders`, {
      headers: { 'x-csrf-token': token },
      data: {},
    });
    expect(validToken.status()).not.toBe(403);

    await api.dispose();
  });

  test('public QR endpoint rejects malformed token prefixes', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/public/qr/validate/<script>`);
    expect(response.status()).toBe(400);
  });
});
