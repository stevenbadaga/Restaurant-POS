import { expect, request, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:5000/api';
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

async function authenticatedApi(email: string) {
  const api = await request.newContext();
  const login = await api.post(`${apiBaseUrl}/auth/login`, {
    data: { email, password: 'password123' },
  });
  expect(login.ok()).toBeTruthy();

  const csrf = await api.get(`${apiBaseUrl}/security/csrf-token`);
  expect(csrf.ok()).toBeTruthy();
  const token = (await csrf.json()).token as string;
  return { api, token };
}

test.describe('menu image handling', () => {
  test('manager can upload, use, replace, delete local images and keep external URLs', async () => {
    const { api, token } = await authenticatedApi('manager@savannabistro.com');

    const upload = await api.post(`${apiBaseUrl}/menu/items/images`, {
      headers: { 'x-csrf-token': token },
      multipart: {
        image: {
          name: 'menu-test.png',
          mimeType: 'image/png',
          buffer: onePixelPng,
        },
      },
    });
    expect(upload.status()).toBe(201);
    const localImageUrl = (await upload.json()).data.imageUrl as string;
    expect(localImageUrl).toMatch(/^\/uploads\/menu\/.+\.png$/);

    const imageResponse = await api.get(`http://localhost:5000${localImageUrl}`);
    expect(imageResponse.ok()).toBeTruthy();

    const externalUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
    const code = `IMG-${Date.now()}`;
    const create = await api.post(`${apiBaseUrl}/menu/items`, {
      headers: { 'x-csrf-token': token },
      data: {
        name: `Image Test ${Date.now()}`,
        code,
        itemType: 'FOOD',
        price: 9.99,
        taxRate: 0,
        requiresPreparation: false,
        trackInventory: false,
        imageUrl: externalUrl,
        displayOrder: 999,
      },
    });
    expect(create.status()).toBe(201);
    const item = (await create.json()).data;
    expect(item.imageUrl).toBe(externalUrl);

    const replace = await api.patch(`${apiBaseUrl}/menu/items/${item.id}`, {
      headers: { 'x-csrf-token': token },
      data: { imageUrl: localImageUrl },
    });
    expect(replace.ok()).toBeTruthy();
    expect((await replace.json()).data.imageUrl).toBe(localImageUrl);

    const removeFromItem = await api.patch(`${apiBaseUrl}/menu/items/${item.id}`, {
      headers: { 'x-csrf-token': token },
      data: { imageUrl: null },
    });
    expect(removeFromItem.ok()).toBeTruthy();

    const deleteImage = await api.delete(`${apiBaseUrl}/menu/items/images`, {
      headers: { 'x-csrf-token': token },
      params: { imageUrl: localImageUrl },
    });
    expect(deleteImage.ok()).toBeTruthy();

    await api.dispose();
  });

  test('waiter cannot upload menu images', async () => {
    const { api, token } = await authenticatedApi('waiter1@savannabistro.com');

    const response = await api.post(`${apiBaseUrl}/menu/items/images`, {
      headers: { 'x-csrf-token': token },
      multipart: {
        image: {
          name: 'forbidden.png',
          mimeType: 'image/png',
          buffer: onePixelPng,
        },
      },
    });

    expect(response.status()).toBe(403);
    await api.dispose();
  });

  test('manager cannot upload spoofed image content', async () => {
    const { api, token } = await authenticatedApi('manager@savannabistro.com');

    const response = await api.post(`${apiBaseUrl}/menu/items/images`, {
      headers: { 'x-csrf-token': token },
      multipart: {
        image: {
          name: 'not-really.png',
          mimeType: 'image/png',
          buffer: Buffer.from('not an image'),
        },
      },
    });

    expect(response.status()).toBe(400);
    await api.dispose();
  });
});
