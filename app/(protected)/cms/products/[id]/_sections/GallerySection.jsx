'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  Loader2,
  Save,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { API_HOST } from '@/config/api';
import {
  uploadProductImages,
  toGalleryImage,
} from '@/lib/product-image-upload';
import {
  useUpdateCmsProductGalleryMutation,
  useDeleteCmsProductGalleryImageMutation,
  useUpdateCmsProductMutation,
} from '@/redux/services';
import { mutationMessage } from '../../_form/productFormModel';

/**
 * Ürün galerisi editörü — yükle / sırala / sil / kapak seç.
 *
 * İKİ AYRI YAZMA YOLU, bilinçli:
 * - TEK GÖRSEL SİLME → `DELETE /cms/product/:pid/gallery/image/:imageid`.
 *   Toplu PUT'un validator'ı `images.min(1)` istiyor, yani son görsel toplu
 *   yolla silinemez. Ayrıca tek silme galeriyi yeniden kurmadığı için ucuz.
 * - EKLEME / SIRALAMA → toplu `PUT /cms/product/:pid/gallery`. Bu uç galeriyi
 *   baştan kurar (yeni image dokümanları yaratır), bu yüzden mevcut görsellerin
 *   `path`'leri de gövdede yeniden gönderilir.
 *
 * Kapsam dışı (dashboard'da var, burada yok): odak noktası (focal point),
 * medya kütüphanesi, AI görsel üretimi.
 */

/** Görsel yolu tam URL değilse backend host'u ile birleştir. */
const resolveImageUrl = (path) => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? '' : '/'}${path}`;
};

const toItem = (img, index) => ({
  key: img?._id || `img-${index}`,
  imageId: img?._id || null,
  path: img?.path || '',
  type: img?.type || 'internal',
  uploadid: img?.uploadid ?? null,
});

export default function GallerySection({ product, onNotice }) {
  const productId = product?._id || product?.id;
  const serverImages = Array.isArray(product?.gallery?.images)
    ? product.gallery.images
    : [];

  const [items, setItems] = useState(() => serverImages.map(toItem));
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const [updateGallery, { isLoading: savingGallery }] =
    useUpdateCmsProductGalleryMutation();
  const [deleteGalleryImage, { isLoading: deletingImage }] =
    useDeleteCmsProductGalleryImageMutation();
  const [updateCmsProduct, { isLoading: savingCover }] =
    useUpdateCmsProductMutation();

  // Ürün yeniden çekildiğinde tazele; kaydedilmemiş sıralama varsa ezme.
  useEffect(() => {
    if (!dirty) setItems(serverImages.map(toItem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const busy = uploading || savingGallery || deletingImage || savingCover;

  const move = (index, delta) => {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    setItems((current) => {
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
    setDirty(true);
  };

  const handleFiles = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const { uploaded, failed } = await uploadProductImages(files);
      setItems((current) => [
        ...current,
        ...uploaded.map((u, i) => ({
          key: `new-${u.uploadid || u.path}-${i}`,
          imageId: null,
          ...toGalleryImage(u),
        })),
      ]);
      setDirty(true);
      onNotice?.({
        variant: failed.length ? 'destructive' : 'info',
        title: failed.length ? 'Kısmi yükleme' : 'Görseller yüklendi',
        description: failed.length
          ? `${uploaded.length} görsel yüklendi, ${failed.length} tanesi başarısız. Kaydetmeyi unutmayın.`
          : `${uploaded.length} görsel eklendi — “Galeriyi kaydet” ile kalıcı hale getirin.`,
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Yükleme başarısız',
        description: err?.message || 'Görsel yüklenemedi.',
      });
    } finally {
      setUploading(false);
      // Aynı dosyayı tekrar seçebilmek için input'u sıfırla.
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!items.length) {
      onNotice?.({
        variant: 'destructive',
        title: 'Görsel yok',
        description:
          'Galeri en az bir görsel içermeli. Tüm görselleri kaldırmak için tek tek silin.',
      });
      return;
    }
    try {
      await updateGallery({
        id: productId,
        gallery: {
          title: product?.gallery?.title || 'Ürün Galerisi',
          description: product?.gallery?.description || '',
          images: items.map((item) => ({
            path: item.path,
            type: item.type,
            uploadid: item.uploadid,
          })),
        },
      }).unwrap();
      setDirty(false);
      onNotice?.({
        variant: 'info',
        title: 'Galeri kaydedildi',
        description: `${items.length} görsel kaydedildi.`,
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Kaydedilemedi',
        description: mutationMessage(err, 'Galeri kaydedilirken hata oluştu.'),
      });
    }
  };

  const handleDelete = async (item, index) => {
    // Henüz kaydedilmemiş görsel → sadece listeden çıkar.
    if (!item.imageId) {
      setItems((current) => current.filter((_, i) => i !== index));
      setDirty(true);
      return;
    }
    try {
      await deleteGalleryImage({ id: productId, imageId: item.imageId }).unwrap();
      setItems((current) => current.filter((_, i) => i !== index));
      onNotice?.({
        variant: 'info',
        title: 'Görsel silindi',
        description: 'Görsel galeriden kaldırıldı.',
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Silinemedi',
        description: mutationMessage(err, 'Görsel silinirken hata oluştu.'),
      });
    }
  };

  // Kapak görseli galeriden bağımsız bir ürün alanı (`coverImage`) → PATCH ile.
  const handleSetCover = async (item) => {
    try {
      await updateCmsProduct({ id: productId, coverImage: item.path }).unwrap();
      onNotice?.({
        variant: 'info',
        title: 'Kapak güncellendi',
        description: 'Seçilen görsel kapak olarak ayarlandı.',
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Kapak ayarlanamadı',
        description: mutationMessage(err, 'Kapak görseli güncellenemedi.'),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Görseller</CardTitle>
        <CardToolbar>
          <div className="flex items-center gap-2">
            <Badge variant="muted">{items.length} görsel</Badge>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              disabled={busy}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Görsel ekle
            </Button>
            <Button size="sm" onClick={handleSave} disabled={busy || !dirty}>
              {savingGallery ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Galeriyi kaydet
            </Button>
          </div>
        </CardToolbar>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {dirty && (
          <Alert variant="warning">
            <AlertDescription>
              Kaydedilmemiş değişiklikler var — “Galeriyi kaydet” demeden sayfadan
              ayrılırsanız kaybolur.
            </AlertDescription>
          </Alert>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
            <ImageIcon className="size-6" />
            Bu ürüne ait görsel yok.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => {
              const isCover =
                product?.coverImage && product.coverImage === item.path;
              return (
                <div
                  key={item.key}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div className="relative aspect-square bg-muted">
                    {/* Harici/CDN yolları için next/image yerine <img>: host
                        allowlist'i gerektirmez. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveImageUrl(item.path)}
                      alt=""
                      className="size-full object-cover"
                    />
                    {isCover && (
                      <Badge variant="primary" className="absolute left-2 top-2">
                        Kapak
                      </Badge>
                    )}
                    {!item.imageId && (
                      <Badge
                        variant="warning"
                        className="absolute right-2 top-2"
                        title="Henüz kaydedilmedi"
                      >
                        Yeni
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 px-1 py-1">
                    <div className="flex items-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Sola taşı"
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowLeft className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Sağa taşı"
                        disabled={busy || index === items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Kapak yap"
                        disabled={busy || isCover || !item.imageId}
                        onClick={() => handleSetCover(item)}
                      >
                        <Star className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Sil"
                        disabled={busy}
                        onClick={() => handleDelete(item, index)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Yükleme, oturumu açan yöneticinin depolama kotasına yazılır — firma
          hesabına değil.
        </p>
      </CardContent>
    </Card>
  );
}
