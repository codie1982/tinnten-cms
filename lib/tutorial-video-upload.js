import { API_BASE_URL, ENDPOINTS } from '@/config/api';
import { getAuthToken } from '@/lib/authToken';
import { absoluteUploadUrl } from '@/lib/image-upload';

/**
 * Eğitim medyasını uygulamaya ait özel S3 alanına yükler. Genel kullanıcı
 * upload/kota akışı bu endpoint'te ÇAĞRILMAZ; dosya video ID'si altında saklanır
 * ve kanonik `files._id` ile envantere bağlanır.
 */
export async function uploadTutorialVideoAsset(file, { tutorialVideoId, assetType, locale } = {}) {
  if (!(file instanceof File)) throw new Error('Yüklenecek dosya seçilmedi.');
  if (!tutorialVideoId || !assetType) throw new Error('Önce eğitim videosu taslağını oluşturun.');

  const formData = new FormData();
  formData.append('files', file);
  formData.append('assetType', assetType);
  if (locale) formData.append('locale', locale);

  const headers = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${ENDPOINTS.tutorialVideos.upload(tutorialVideoId)}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });
  } catch {
    throw new Error('Dosya yükleme sunucusuna ulaşılamadı.');
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(json?.message || `Dosya yüklenemedi (HTTP ${response.status}).`);
  }

  const data = json?.data ?? json;
  const asset = data?.asset;
  if (!asset?.url || !asset?.fileId || !asset?.storageKey) {
    throw new Error(data?.failedUploads?.[0]?.error || 'Dosya yüklenemedi.');
  }
  return { ...asset, url: absoluteUploadUrl(asset.url) };
}
