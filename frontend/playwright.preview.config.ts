import { defineConfig } from '@playwright/test'
import config from './playwright.config'

export default defineConfig({
  ...config,
  metadata: { backendOrigin: 'http://127.0.0.1:8080' },
  webServer: {
    ...config.webServer,
    command: 'npm run preview -- --host 127.0.0.1 --port 5178 --strictPort',
  },
})
