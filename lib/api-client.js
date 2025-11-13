const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001/api/v10';

export function apiUrl(path) {
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
}

export async function apiFetch(path, { method = 'GET', body, accessToken, headers = {}, signal } = {}) {
  const res = await fetch(apiUrl(path), {
    method,
    credentials: 'include', // include refresh_token cookie for same backend origin
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = (isJson ? data?.error || data?.message : data) || `Request failed: ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function loginRequest({ email, password, rememberme = true, device = 'web', deviceid }) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: { email, password, rememberme, device, deviceid },
  });
}

export async function refreshAccessToken() {
  return apiFetch('/auth/refresh-token', { method: 'POST' });
}

export async function logoutRequest(accessToken) {
  return apiFetch('/auth/logout', { method: 'POST', accessToken });
}

export async function getMe(accessToken) {
  return apiFetch('/profile/me', { method: 'GET', accessToken });
}

