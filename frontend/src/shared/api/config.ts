// Local development talks to Spring directly; deployed builds use the Vercel proxy.
export const BACKEND_URL = import.meta.env.DEV ? 'http://127.0.0.1:8080' : ''
export const SPOTIFY_LOGIN_URL = `${BACKEND_URL}/oauth2/authorization/spotify`
