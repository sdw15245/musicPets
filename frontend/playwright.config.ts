import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  metadata: { backendOrigin: 'http://127.0.0.1:8080' },
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5178', channel: process.env.CI ? 'chromium' : 'chrome', headless: true },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
  },
})
