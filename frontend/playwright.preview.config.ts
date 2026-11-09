import { defineConfig } from '@playwright/test'
import config from './playwright.config'

export default defineConfig({
  ...config,
  webServer: {
    ...config.webServer,
    command: 'npm run preview -- --host 127.0.0.1 --port 5178 --strictPort',
  },
})
