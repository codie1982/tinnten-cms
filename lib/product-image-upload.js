import { uploadImages } from '@/lib/image-upload';

/**
 * Ürün galerisi için görsel yükler. Yükleme mantığı CMS genelinde ortak —
 * `lib/image-upload.js` (multipart bypass, kota/hata sözleşmesi orada anlatılı).
 *
 * @param {File[]|FileList} files
 * @returns {Promise<{ uploaded: Array<{uploadid: string|null, name: string, path: string}>, failed: Array<{name: string, error: string}> }>}
 */
export async function uploadProductImages(files) {
  return uploadImages(files);
}

/** Yükleme sonucunu galeri PUT gövdesindeki image girdisine çevirir. */
export function toGalleryImage(upload) {
  return {
    path: upload.path,
    type: 'internal',
    uploadid: upload.uploadid ?? null,
  };
}
