// React 진입점. StrictMode + React Query QueryClient 전역 주입.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@seed-design/css/base.css'
import './styles/base.css'
import App from './App.tsx'
import { SnackbarProvider } from 'seed-design/ui/snackbar'
import './styles/theme.css'
import './shared/components/taste-preview.css'
import './features/landing/landing.css'
import './features/auth/auth.css'
import './features/result/result.css'
import './features/community/community.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 1000 * 60,
    },
  },
})

// Remove credentials left by older app versions, without ever reading/trusting them.
try { localStorage.removeItem('auth') } catch { /* Storage can be disabled. */ }
if (window.location.pathname === '/oauth/callback') {
  window.history.replaceState(window.history.state, '', '/oauth/callback')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider><App /></SnackbarProvider>
    </QueryClientProvider>
  </StrictMode>,
)
