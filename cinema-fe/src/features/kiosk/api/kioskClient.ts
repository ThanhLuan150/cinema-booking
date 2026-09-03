import axios from 'axios';

// Where the kiosk's API key lives on this specific machine. The kiosk app is not a signed-in
// user session — it authenticates every request with the X-Kiosk-Key header instead of a JWT.
export const KIOSK_KEY_STORAGE = 'kiosk.apiKey';

export function getStoredKioskKey(): string | null {
  try {
    return localStorage.getItem(KIOSK_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setStoredKioskKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KIOSK_KEY_STORAGE, key);
    else localStorage.removeItem(KIOSK_KEY_STORAGE);
  } catch {
    /* private mode / storage disabled — the app still works for this session */
  }
}

// A dedicated client: NOT services/apiClient (which injects the user JWT and runs the
// refresh-token dance). This one only ever speaks to /kiosks/* with the device key.
export const kioskClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

kioskClient.interceptors.request.use((config) => {
  const key = getStoredKioskKey();
  if (key) config.headers['X-Kiosk-Key'] = key;
  return config;
});

export default kioskClient;
