import { API_BASE_URL, ENDPOINTS } from '@/config/api';
import { getAuthToken } from '@/lib/authToken';

export async function uploadDocMedia(file) {
  if (!(file instanceof File)) throw new Error('Dosya seçilmedi.');
  const formData = new FormData();
  formData.append('files', file);
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${ENDPOINTS.docs.assets}`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.message || `Medya yüklenemedi (HTTP ${response.status}).`);
  const asset = (json?.data ?? json)?.asset;
  if (!asset?.url) throw new Error('Yüklenen medya adresi alınamadı.');
  return asset;
}
