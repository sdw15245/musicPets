import { PRODUCTION_API_ORIGIN } from './origins'
// The browser calls the backend directly. E2E uses a local mock origin with the same cross-origin flow.
const local = import.meta.env.DEV || import.meta.env.MODE === 'e2e'
export const BACKEND_URL = local ? 'http://127.0.0.1:8080' : PRODUCTION_API_ORIGIN
export const SPOTIFY_LOGIN_URL = `${BACKEND_URL}/oauth2/authorization/spotify`
