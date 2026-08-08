import axios from 'axios';
import { STORAGE_KEYS } from '@/constants/storage';
import { store } from '@/app/store';
import { setAccessToken, logout } from '@/features/auth/store/authSlice';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${import.meta.env.VITE_API_BASE_URL}/refresh-token`, null, { withCredentials: true })
      .then((res) => res.data.accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const SKIP_REFRESH_URLS = ['/Login', '/refresh-token'];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const shouldRetry =
      response?.status === 401 && config && !config._retry && !SKIP_REFRESH_URLS.some((url) => config.url?.includes(url));

    if (!shouldRetry) {
      return Promise.reject(error);
    }

    config._retry = true;
    try {
      const accessToken = await refreshAccessToken();
      store.dispatch(setAccessToken(accessToken));
      config.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      store.dispatch(logout());
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
