import { API_BASE_URL, API_HOST, ENDPOINTS } from '@/config/api';
import { getAuthToken } from '@/lib/authToken';

/**
 * CMS'in ortak görsel yükleyicisi (`POST /upload/multiple/image`).
 *
 * Neden RTK Query değil düz fetch: baseApi.prepareHeaders her istekte
 * `Content-Type: application/json` set ediyor (redux/services/baseApi.js:28).
 * FormData gövdesinde bu, tarayıcının multipart `boundary`'sini ezerek isteği
 * bozar. Burada Content-Type'ı elle set ETMEYİP tarayıcının üretmesine izin
 * veriyoruz; sadece Authorization ekliyoruz (baseApi ile aynı in-memory token
 * kaynağı: lib/authToken). Aynı desen: lib/mail-attachment-upload.js.
 *
 * companyid GÖNDERİLMİYOR: backend `companyid` verilirse paylaşılan
 * helpers/companyHelper.js üyelik kapısını uyguluyor
 * (uploadController.js:508) ve firma üyesi olmayan CMS admini 403 alırdı.
 * Alan boş bırakılınca yükleme çağıranın kendi hesabına yazılır — dosya
 * işlevsel olarak aynı, yalnız depolama kotası admin hesabına sayılır.
 *
 * Backend alan adı `files` (req.files.files) ve çoklu dosya kabul ediyor;
 * dönen kayıt `{ uploadid, name, path }` (path = S3 location).
 *
 * @param {File[]|FileList} files
 * @returns {Promise<{ uploaded: Array<{uploadid: string|null, name: string, path: string}>, failed: Array<{name: string, error: string}> }>}
 */
export async function uploadImages(files) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) throw new Error('Dosya seçilmedi.');

  const formData = new FormData();
  for (const file of list) formData.append('files', file);

  const token = getAuthToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${ENDPOINTS.upload.image}`, {
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
    json = null;
  }

  if (!res.ok) {
    throw new Error(json?.message || `Görsel yüklenemedi (HTTP ${res.status}).`);
  }

  const data = json?.data ?? json;
  const uploaded = Array.isArray(data?.successfullUploads)
    ? data.successfullUploads
    : [];
  const failed = Array.isArray(data?.failedUploads) ? data.failedUploads : [];

  // Kota aşımı backend'de 2xx + failedUploads olarak dönebiliyor; sessiz
  // "yüklendi" göstermemek için ayrıca işaretleniyor.
  if (!uploaded.length) {
    throw new Error(
      failed[0]?.error ||
        (data?.limitExceeded
          ? 'Depolama kotası dolu.'
          : 'Hiçbir görsel yüklenemedi.'),
    );
  }

  return { uploaded, failed };
}

/**
 * Yükleme yolunu mutlak URL'e çevirir. S3 `location` zaten mutlak döner; bu
 * yalnızca backend göreli bir yol döndürdüğü durumlar için güvenlik ağı —
 * haber görselleri public sitede render edildiği için göreli yol işe yaramaz.
 */
export function absoluteUploadUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Dosyaları yükleyip doğrudan kullanılabilir mutlak URL listesine indirger.
 * (Haber görselleri kayıtta `imageUrl` alanına düz URL olarak yazılır.)
 *
 * @param {File[]|FileList} files
 * @returns {Promise<{ urls: string[], failed: Array<{name: string, error: string}> }>}
 */
export async function uploadImagesAsUrls(files) {
  const { uploaded, failed } = await uploadImages(files);
  return {
    urls: uploaded.map((u) => absoluteUploadUrl(u.path)).filter(Boolean),
    failed,
  };
}
