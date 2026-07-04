import axios from 'axios';
import { getAuthToken, setAuthToken } from '@/lib/authToken';
import { refreshSessionToken } from '@/lib/sessionRefresh';
import { API_BASE_URL, API_TIMEOUT } from '@/config/api';

const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: API_TIMEOUT,
});

// Token varsa Authorization header'ına ekle
http.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

const normalizeAxiosError = (error) => {
  const data = error.response?.data;
  const message =
    (typeof data === 'object' ? data?.message || data?.status?.description : data) ||
    error.message ||
    'Sunucu hatası oluştu.';
  const normalized = new Error(message);
  normalized.status = error.response?.status;
  normalized.data = data;
  return normalized;
};

// 401 güvenlik ağı: proaktif yenilemeyi (SessionProvider refetchInterval + jwt
// callback) kaçıran bir istek 401 alırsa, NextAuth session'ını zorla tazele
// (getSession → jwt callback → backend refresh) ve isteği TEK sefer retry et.
// Kalıcı hata (session.error) → useSyncAuthToken zaten signOut ediyor.
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      typeof window !== 'undefined'
    ) {
      original._retry = true;
      try {
        const newToken = await refreshSessionToken();
        if (!newToken) {
          // Oturum ölü → useSyncAuthToken signOut edecek; isteği reddet.
          return Promise.reject(normalizeAxiosError(error));
        }
        setAuthToken(newToken);
        original.headers = original.headers || {};
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return http(original);
      } catch {
        // Yenileme başarısız → normalize edilmiş hatayı döndür.
        return Promise.reject(normalizeAxiosError(error));
      }
    }

    return Promise.reject(normalizeAxiosError(error));
  },
);

export default http;
