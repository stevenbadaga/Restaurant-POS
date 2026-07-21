import { expect, request, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:5000/api';
const password = 'password123';

async function login(email: string) {
  const api = await request.newContext();
  let loginResponse;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      loginResponse = await api.post(`${apiBaseUrl}/auth/login`, {
        data: { email, password },
      });
      if (loginResponse.ok()) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  expect(loginResponse?.ok()).toBeTruthy();

  const csrfResponse = await api.get(`${apiBaseUrl}/security/csrf-token`);
  expect(csrfResponse.ok()).toBeTruthy();
  const csrfToken = (await csrfResponse.json()).token;

  const meResponse = await api.get(`${apiBaseUrl}/auth/me`);
  expect(meResponse.ok()).toBeTruthy();
  const mePayload = await meResponse.json();
  const user = mePayload.data || mePayload;

  return { api, csrfToken, user };
}

test.describe('notification preferences', () => {
  test('users can manage their own in-app and sound category preferences', async () => {
    const { api, csrfToken } = await login('waiter1@savannabistro.com');

    const defaults = await api.get(`${apiBaseUrl}/notifications/preferences`);
    expect(defaults.ok()).toBeTruthy();
    const defaultPreferences = (await defaults.json()).data.preferences;
    expect(defaultPreferences).toHaveLength(8);
    const allEnabled = defaultPreferences.map((pref: any) => ({
      category: pref.category,
      inAppEnabled: true,
      soundEnabled: true,
    }));
    const normalizeResponse = await api.put(`${apiBaseUrl}/notifications/preferences`, {
      headers: { 'x-csrf-token': csrfToken },
      data: { preferences: allEnabled },
    });
    expect(normalizeResponse.ok()).toBeTruthy();

    const updated = allEnabled.map((pref: any) =>
      pref.category === 'ORDER'
        ? { category: pref.category, inAppEnabled: false, soundEnabled: true }
        : { category: pref.category, inAppEnabled: pref.inAppEnabled, soundEnabled: pref.soundEnabled }
    );

    const updateResponse = await api.put(`${apiBaseUrl}/notifications/preferences`, {
      headers: { 'x-csrf-token': csrfToken },
      data: { preferences: updated },
    });
    expect(updateResponse.ok()).toBeTruthy();
    const saved = (await updateResponse.json()).data.preferences.find((pref: any) => pref.category === 'ORDER');
    expect(saved.inAppEnabled).toBe(false);
    expect(saved.soundEnabled).toBe(false);

    const restore = updated.map((pref: any) =>
      pref.category === 'ORDER' ? { category: 'ORDER', inAppEnabled: true, soundEnabled: true } : pref
    );
    const restoreResponse = await api.put(`${apiBaseUrl}/notifications/preferences`, {
      headers: { 'x-csrf-token': csrfToken },
      data: { preferences: restore },
    });
    expect(restoreResponse.ok()).toBeTruthy();

    await api.dispose();
  });

  test('managers can update staff preferences and waiters cannot update other users', async () => {
    const manager = await login('manager@savannabistro.com');
    const waiter = await login('waiter1@savannabistro.com');

    const waiterPrefs = await manager.api.get(`${apiBaseUrl}/notifications/preferences`, {
      params: { userId: waiter.user.id },
    });
    expect(waiterPrefs.ok()).toBeTruthy();
    const preferences = (await waiterPrefs.json()).data.preferences;

    const managerUpdate = await manager.api.put(`${apiBaseUrl}/notifications/preferences`, {
      params: { userId: waiter.user.id },
      headers: { 'x-csrf-token': manager.csrfToken },
      data: {
        preferences: preferences.map((pref: any) =>
          pref.category === 'STOCK'
            ? { category: pref.category, inAppEnabled: true, soundEnabled: false }
            : { category: pref.category, inAppEnabled: pref.inAppEnabled, soundEnabled: pref.soundEnabled }
        ),
      },
    });
    expect(managerUpdate.ok()).toBeTruthy();
    const stockPref = (await managerUpdate.json()).data.preferences.find((pref: any) => pref.category === 'STOCK');
    expect(stockPref.soundEnabled).toBe(false);

    const forbidden = await waiter.api.put(`${apiBaseUrl}/notifications/preferences`, {
      params: { userId: manager.user.id },
      headers: { 'x-csrf-token': waiter.csrfToken },
      data: { preferences },
    });
    expect(forbidden.status()).toBe(403);

    const restoreResponse = await manager.api.put(`${apiBaseUrl}/notifications/preferences`, {
      params: { userId: waiter.user.id },
      headers: { 'x-csrf-token': manager.csrfToken },
      data: { preferences },
    });
    expect(restoreResponse.ok()).toBeTruthy();

    await manager.api.dispose();
    await waiter.api.dispose();
  });
});
