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
  return api;
}

function sumNumber(rows: any[], key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

test.describe('waiter assignment report', () => {
  test('manager can view accurate waiter assignment totals and export CSV/PDF', async ({ page }) => {
    const api = await login('manager@savannabistro.com');

    const reportResponse = await api.get(`${apiBaseUrl}/reports/waiter-assignments`, {
      params: { preset: 'today', limit: 100 },
    });
    expect(reportResponse.ok()).toBeTruthy();
    const report = (await reportResponse.json()).data;
    expect(Array.isArray(report.waiters)).toBeTruthy();
    expect(report.totals).toBeTruthy();

    expect(Number(report.totals.assignedTableCount)).toBe(sumNumber(report.waiters, 'assignedTableCount'));
    expect(Number(report.totals.activeOrderCount)).toBe(sumNumber(report.waiters, 'activeOrderCount'));
    expect(Number(report.totals.customersServed)).toBe(sumNumber(report.waiters, 'customersServed'));
    expect(Number(report.totals.totalOrders)).toBe(sumNumber(report.waiters, 'totalOrders'));
    expect(Number(report.totals.sales).toFixed(2)).toBe(sumNumber(report.waiters, 'sales').toFixed(2));
    expect(Number(report.totals.tips).toFixed(2)).toBe(sumNumber(report.waiters, 'tips').toFixed(2));
    expect(Number(report.totals.workedHours).toFixed(2)).toBe(sumNumber(report.waiters, 'workedHours').toFixed(2));

    const csv = await api.get(`${apiBaseUrl}/reports/export`, {
      params: { reportType: 'waiter_assignments', format: 'csv', preset: 'today' },
    });
    expect(csv.ok()).toBeTruthy();
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect(await csv.text()).toContain('Waiter');

    const pdf = await api.get(`${apiBaseUrl}/reports/export`, {
      params: { reportType: 'waiter_assignments', format: 'pdf', preset: 'today' },
    });
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()['content-type']).toContain('application/pdf');

    await page.goto('/login');
    await page.getByLabel('Email address').fill('manager@savannabistro.com');
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/reports/waiter-assignments');
    await expect(page.getByRole('heading', { name: /waiter assignment report/i })).toBeVisible();
    await expect(page.getByText(/assigned tables/i).first()).toBeVisible();

    await api.dispose();
  });

  test('waiter cannot access waiter assignment report', async () => {
    const api = await login('waiter1@savannabistro.com');
    const response = await api.get(`${apiBaseUrl}/reports/waiter-assignments`, {
      params: { preset: 'today' },
    });
    expect(response.status()).toBe(403);

    const exportResponse = await api.get(`${apiBaseUrl}/reports/export`, {
      params: { reportType: 'waiter_assignments', format: 'csv', preset: 'today' },
    });
    expect(exportResponse.status()).toBe(403);
    await api.dispose();
  });
});
