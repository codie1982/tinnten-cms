import { API_BASE_URL, ENDPOINTS } from '@/config/api';
import { getAuthToken } from '@/lib/authToken';

/**
 * Tek bir dosyayı mail eki olarak backend'e yükler.
 *
 * Neden RTK Query değil düz fetch:
 *  baseApi.prepareHeaders her istekte `Content-Type: application/json` set ediyor
 *  (redux/services/baseApi.js). FormData gövdesinde bu, tarayıcının multipart
 *  `boundary`'sini ezerek isteği bozar. Burada Content-Type'ı elle set ETMEYİP
 *  tarayıcının multipart header'ını üretmesine izin veriyoruz; sadece Authorization
 *  ekliyoruz (baseApi ile aynı in-memory token kaynağı: lib/authToken).
 *
 * @param {File} file
 * @returns {Promise<{ filename: string, url: string, size: number, mimeType: string }>}
 */
export async function uploadMailAttachment(file) {
  if (!file) throw new Error('Dosya bulunamadı.');

  const formData = new FormData();
  formData.append('file', file);

  const token = getAuthToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${ENDPOINTS.email.attachmentUpload}`, {
      method: 'POST',
      credentials: 'include',
      headers, // Content-Type YOK → tarayıcı multipart/form-data + boundary üretir
      body: formData,
    });
  } catch {
    throw new Error('Sunucuya ulaşılamadı.');
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // gövde JSON değilse aşağıdaki hata dalına düşer
  }

  if (!res.ok) {
    const message = json?.message || json?.status?.description || `Yükleme başarısız (${res.status}).`;
    throw new Error(message);
  }

  const data = json?.data ?? json;
  if (!data?.url) throw new Error('Yükleme yanıtı geçersiz (url yok).');

  return {
    filename: data.filename || file.name,
    url: data.url,
    size: data.size ?? file.size,
    mimeType: data.mimeType || file.type,
  };
}
