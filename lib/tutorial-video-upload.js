import { API_BASE_URL, ENDPOINTS } from '@/config/api';
import { getAuthToken } from '@/lib/authToken';
import { absoluteUploadUrl } from '@/lib/image-upload';

const ALLOWED_TYPE_BY_ASSET = {
  video: 'video',
  audio: 'song',
  subtitle: 'file',
  thumbnail: 'image',
};

/**
 * Eğitim videosu varlıklarını server'ın mevcut dosya envanteri/S3 akışıyla
 * yükler. RTK Query kullanılmaz; FormData için multipart boundary'sini
 * tarayıcının üretmesi gerekir.
 */
export async function uploadTutorialVideoAsset(file, assetType) {
  if (!(file instanceof File)) throw new Error('Yüklenecek dosya seçilmedi.');
  const allowedType = ALLOWED_TYPE_BY_ASSET[assetType];
  if (!allowedType) throw new Error('Geçersiz medya türü.');

  const formData = new FormData();
  formData.append('files', file);
  formData.append('allowedTypes', allowedType);

  const headers = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${ENDPOINTS.tutorialVideos.upload}`, {
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
  const uploaded = Array.isArray(data?.successfullUploads) ? data.successfullUploads[0] : null;
  if (!uploaded?.path) {
    throw new Error(data?.failedUploads?.[0]?.error || 'Dosya yüklenemedi.');
  }

  return {
    url: absoluteUploadUrl(uploaded.path),
    uploadId: uploaded.uploadid ?? null,
    fileName: uploaded.name || file.name,
    mimeType: file.type || null,
    sizeBytes: Number(uploaded.size ?? file.size) || null,
  };
}
