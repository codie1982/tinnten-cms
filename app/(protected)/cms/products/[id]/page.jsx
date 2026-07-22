'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  useGetCmsProductQuery,
  useNotifyCmsProductsEditedMutation,
  useUpdateCmsProductMutation,
} from '@/redux/services';
import {
  Boxes,
  Building2,
  CalendarClock,
  Edit3,
  ExternalLink,
  Hash,
  Layers,
  ListChecks,
  Loader2,
  Mail,
  Package,
  ShieldCheck,
  ShieldOff,
  Tag,
  Truck,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { API_HOST } from '@/config/api';
import { canAccess, CMS_ROLES } from '@/lib/roles';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/page-shell';
import {
  adminAproveMeta,
  formatPrice,
  pricetypeMeta,
  serviceTypeMeta,
  statusMeta,
  stockStatusMeta,
  typeMeta,
} from '../_data';
import {
  buildProductForm,
  mutationMessage,
  toPatchPayload,
  validateProductForm,
} from '../_form/productFormModel';
import { ProductFormDialog } from '../_form/ProductFormDialog';
import GallerySection from './_sections/GallerySection';
import PricingSection from './_sections/PricingSection';
import SchedulingSection from './_sections/SchedulingSection';
import FormsSection from './_sections/FormsSection';
import LocationSection from './_sections/LocationSection';

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Görsel yolu tam URL değilse backend host'u ile birleştir. */
function resolveImageUrl(path) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? '' : '/'}${path}`;
}

function InfoRow({ icon: Icon, label, value, href }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && (
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {value || '—'} <ExternalLink className="size-3" />
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground break-words">
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CmsProductDetailPage({ params }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const {
    data: product,
    isLoading,
    error,
  } = useGetCmsProductQuery(id, { skip: !authorized });
  const [updateCmsProduct, { isLoading: isUpdating }] =
    useUpdateCmsProductMutation();
  const [notifyCmsProductsEdited, { isLoading: isNotifying }] =
    useNotifyCmsProductsEditedMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(() => buildProductForm(null));
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (product) setEditForm(buildProductForm(product));
  }, [product]);

  const setField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const handleNotifyOwner = async () => {
    try {
      const result = await notifyCmsProductsEdited({
        productIds: [id],
        reason: product?.reason || '',
      }).unwrap();
      setNotice({
        variant: 'info',
        title: 'Bildirim gönderildi',
        description: `${result?.sent ?? 0} alıcıya düzenleme bildirimi gönderildi.`,
      });
    } catch (err) {
      setNotice({
        variant: 'destructive',
        title: 'Bildirim gönderilemedi',
        description: mutationMessage(
          err,
          'Mail bildirimi sırasında hata oluştu.',
        ),
      });
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateProductForm(editForm, { requireSku: true });
    if (validationError) {
      setNotice({
        variant: 'destructive',
        title: 'Form eksik',
        description: validationError,
      });
      return;
    }

    // Gövde şekli (tekrarlı fiyat kilidi, basePrice varken priceAmount'ın
    // atlanması, redirectUrl'in diziye çevrilmesi) toPatchPayload'da.
    const payload = { id, ...toPatchPayload(editForm, product) };

    try {
      const result = await updateCmsProduct(payload).unwrap();
      setEditOpen(false);
      setNotice({
        variant: 'info',
        title: 'Ürün güncellendi',
        description: result?.notification
          ? `${result.notification.sent ?? 0} alıcıya düzenleme bildirimi gönderildi.`
          : 'Değişiklikler kaydedildi.',
      });
    } catch (err) {
      setNotice({
        variant: 'destructive',
        title: 'Güncelleme başarısız',
        description: mutationMessage(err, 'Ürün güncellenirken hata oluştu.'),
      });
    }
  };

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader
          breadcrumb={[
            { label: 'Ürünler & Hizmetler', href: '/cms/products' },
            { label: '…' },
          ]}
          title="Yükleniyor…"
        />
        <div className="space-y-5">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </RoleGuard>
    );
  }

  if (error || !product) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader
          breadcrumb={[
            { label: 'Ürünler & Hizmetler', href: '/cms/products' },
            { label: 'Bulunamadı' },
          ]}
          title="Ürün Bulunamadı"
        />
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {error
              ? error?.data?.message ||
                error?.normalizedMessage ||
                'Yükleme hatası.'
              : 'Bu ürün bulunamadı.'}{' '}
            <Link href="/cms/products" className="text-primary hover:underline">
              Listeye dön
            </Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  const t = typeMeta[product.type];
  const s = statusMeta[product.status];
  // Eski kayıtlar hâlâ 'rental' taşıyabilir → 'recurring' olarak ele al.
  const pricetypeKey =
    product.pricetype === 'rental' ? 'recurring' : product.pricetype;
  const pt = pricetypeMeta[pricetypeKey];
  // Tekrarlı ürünlerde fiyat tipi CMS'te değiştirilemez (edit dialog kilidi).
  const isRecurringProduct = pricetypeKey === 'recurring';
  const adminApproved = product.admin_aprove !== false;
  const adminMeta = adminAproveMeta[String(adminApproved)];
  const company =
    product.companyid && typeof product.companyid === 'object'
      ? product.companyid
      : null;
  const categories = Array.isArray(product.categories)
    ? product.categories.filter(Boolean)
    : [];
  const attributes = Array.isArray(product.attributes)
    ? product.attributes
    : [];
  const galleryImages = Array.isArray(product.gallery?.images)
    ? product.gallery.images
    : [];
  const isProduct = product.type === 'product';
  const stock = product.stock || {};
  const stockMeta = stockStatusMeta[stock.status];
  const shipping = product.shipping || {};
  const timeR = product.timeRestriction || {};
  const reservation = product.reservationConfig || {};

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[
          { label: 'Ürünler & Hizmetler', href: '/cms/products' },
          { label: product.title },
        ]}
        title={product.title}
      />

      <div className="space-y-5">
        {notice && (
          <Alert variant={notice.variant}>
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription>{notice.description}</AlertDescription>
          </Alert>
        )}

        {/* Üst başlık kartı */}
        <Card>
          <CardContent className="flex flex-wrap items-start gap-4 p-5">
            <Avatar
              name={product.title}
              src={resolveImageUrl(product.coverImage) || undefined}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {product.title}
                </h2>
                {t && <Badge variant={t.variant}>{t.label}</Badge>}
                {s && <Badge variant={s.variant}>{s.label}</Badge>}
                {pt && <Badge variant={pt.variant}>{pt.label}</Badge>}
                <Badge variant={adminMeta.variant}>{adminMeta.label}</Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                SKU: {product.sku || '—'}
              </p>
              {company && (
                <Link
                  href={`/cms/companies/${company._id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Building2 className="size-4" />
                  {company.companyName || company.slug || 'Firma'}
                </Link>
              )}
            </div>
            <div className="flex flex-col items-end gap-3 text-right">
              <div>
                <p className="text-xs text-muted-foreground">Fiyat</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatPrice(product.priceAmount, product.currency)}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditForm(buildEditForm(product));
                    setEditOpen(true);
                  }}
                >
                  <Edit3 className="size-4" />
                  Düzenle
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNotifyOwner}
                  disabled={isNotifying}
                >
                  {isNotifying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  Bildirim gönder
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin kontrolü */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Kontrolü</CardTitle>
            <CardToolbar>
              {adminApproved ? (
                <ShieldCheck className="size-4 text-emerald-600" />
              ) : (
                <ShieldOff className="size-4 text-destructive" />
              )}
            </CardToolbar>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
            <div className="flex items-center gap-3 py-2">
              {adminApproved ? (
                <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <ShieldOff className="size-4 shrink-0 text-destructive" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">Admin Durumu</p>
                <Badge variant={adminMeta.variant}>{adminMeta.label}</Badge>
              </div>
            </div>
            <InfoRow label="Reason" value={product.reason || '—'} />
          </CardContent>
        </Card>

        <ProductFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          form={editForm}
          setField={setField}
          product={product}
          onSubmit={handleEditSubmit}
          pending={isUpdating}
        />

        {/* Zamanlama & Rezervasyon (yalnızca hizmet) */}
        {product.type === 'services' && (
          <SchedulingSection product={product} onNotice={setNotice} />
        )}

        {/* Formlar (AI ile oluştur / mevcut formu seç) */}
        <FormsSection product={product} onNotice={setNotice} />

        {/* Konum */}
        <LocationSection product={product} onNotice={setNotice} />

        {/* Genel bilgiler */}
        <Card>
          <CardHeader>
            <CardTitle>Genel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
            <InfoRow icon={Package} label="Başlık" value={product.title} />
            <InfoRow icon={Hash} label="SKU" value={product.sku} />
            <InfoRow icon={Hash} label="Slug" value={product.slug} />
            <InfoRow icon={Tag} label="Marka" value={product.brand} />
            <InfoRow
              icon={Layers}
              label="Tür"
              value={t?.label ?? product.type}
            />
            {product.type === 'services' && (
              <InfoRow
                icon={Layers}
                label="Hizmet Tipi"
                value={
                  serviceTypeMeta[product.serviceType]?.label ??
                  product.serviceType
                }
              />
            )}
            <InfoRow
              icon={Boxes}
              label="Fiyat Tipi"
              value={pt?.label ?? product.pricetype}
            />
            <InfoRow
              icon={CalendarClock}
              label="Oluşturulma"
              value={formatTrDate(product.createdAt)}
            />
            <InfoRow
              icon={CalendarClock}
              label="Güncellenme"
              value={formatTrDate(product.updatedAt)}
            />
            {product.summary && (
              <div className="sm:col-span-2">
                <InfoRow label="Özet" value={product.summary} />
              </div>
            )}
            {product.description && (
              <div className="sm:col-span-2">
                <InfoRow label="Açıklama" value={product.description} />
              </div>
            )}
            {categories.length > 0 && (
              <div className="sm:col-span-2 py-2">
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Kategoriler
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c, i) => (
                    <Badge key={i} variant="muted">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fiyatlandırma — basePrice planları düzenlenebilir (PricingSection). */}
        <PricingSection product={product} onNotice={setNotice} />

        {/* Stok (sadece ürün) */}
        {isProduct && (
          <Card>
            <CardHeader>
              <CardTitle>Stok</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
              <div className="flex items-center gap-3 py-2">
                <Boxes className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Durum</p>
                  {stockMeta ? (
                    <Badge variant={stockMeta.variant}>{stockMeta.label}</Badge>
                  ) : (
                    <p className="text-sm font-medium text-foreground">
                      {stock.status || '—'}
                    </p>
                  )}
                </div>
              </div>
              <InfoRow
                icon={Boxes}
                label="Miktar"
                value={stock.quantity != null ? String(stock.quantity) : '—'}
              />
            </CardContent>
          </Card>
        )}

        {/* Görseller — yükleme/sıralama/silme GallerySection'da. Boş galeride
            de render edilir: yükleme girişi orada. */}
        <GallerySection product={product} onNotice={setNotice} />

        {/* Özellikler */}
        {attributes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Özellikler</CardTitle>
              <CardToolbar>
                <Badge variant="muted">{attributes.length} özellik</Badge>
              </CardToolbar>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Özellik</TableHead>
                    <TableHead>Değer</TableHead>
                    <TableHead>Tür</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attributes.map((a, i) => (
                    <TableRow key={a._id || i}>
                      <TableCell className="font-medium">
                        {a.label || a.key}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.value}
                        {a.unit ? ` ${a.unit}` : ''}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.type || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Kargo (sadece ürün) */}
        {isProduct && (
          <Card>
            <CardHeader>
              <CardTitle>Kargo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
              <InfoRow
                icon={Truck}
                label="Kargoya Uygun"
                value={shipping.shippable === false ? 'Hayır' : 'Evet'}
              />
              <InfoRow
                icon={Truck}
                label="Ücret Modeli"
                value={
                  shipping.priceMode === 'free'
                    ? 'Ücretsiz'
                    : shipping.priceMode === 'free_over_threshold'
                      ? `${formatPrice(shipping.freeOverAmount, product.currency)} üzeri ücretsiz`
                      : 'Ücretli'
                }
              />
              {shipping.priceMode !== 'free' && (
                <InfoRow
                  icon={Truck}
                  label="Kargo Ücreti"
                  value={formatPrice(shipping.price, product.currency)}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Boş içerik durumu (galeri/özellik/stok hiçbiri yoksa bilgi) */}
        {!isProduct &&
          !attributes.length &&
          !galleryImages.length &&
          !timeR.enabled &&
          !reservation.enabled && (
            <EmptyState
              icon={<ListChecks className="size-5" />}
              title="Ek detay yok"
              description="Bu hizmet için ek özellik, görsel veya rezervasyon ayarı bulunmuyor."
              className="py-10"
            />
          )}
      </div>
    </RoleGuard>
  );
}
