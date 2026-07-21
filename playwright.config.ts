import { defineConfig, devices } from '@playwright/test';

const frontendDevCommand =
  process.platform === 'win32'
    ? 'cmd /c "set VITE_API_URL=/api&& npm --prefix frontend run dev -- --host 127.0.0.1"'
    : 'VITE_API_URL=/api npm --prefix frontend run dev -- --host 127.0.0.1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: frontendDevCommand,
    url: 'http://localhost:5173/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
