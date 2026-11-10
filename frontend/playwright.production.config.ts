import { defineConfig } from '@playwright/test'
import config from './playwright.preview.config'

// Verify the real production build target with mocked API responses.
export default defineConfig({
  ...config,
  metadata: { backendOrigin: 'https://api.musicpets.store' },
  testMatch: 'deployment-origin.spec.ts',
})
