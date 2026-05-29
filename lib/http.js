import axios from 'axios';
import { getAuthToken } from '@/lib/authToken';
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

// Hata yanıtlarını normalize et
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const message =
      (typeof data === 'object' ? data?.message || data?.status?.description : data) ||
      error.message ||
      'Sunucu hatası oluştu.';
    const normalized = new Error(message);
    normalized.status = error.response?.status;
    normalized.data = data;
    return Promise.reject(normalized);
  },
);

export default http;
