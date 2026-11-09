import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seedDesignPlugin } from '@seed-design/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  build: {
    manifest: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
  server: { host: '127.0.0.1' },
  plugins: [react(), tailwindcss(), seedDesignPlugin({ colorMode: 'light-only', fontScaling: true })],
  resolve: { tsconfigPaths: true },
})
