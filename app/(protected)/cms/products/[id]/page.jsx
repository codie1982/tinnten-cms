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
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  Mail,
  Package,
  Save,
  ShieldCheck,
  ShieldOff,
  Tag,
  Truck,
  Wallet,
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  statusMeta,
  statusOptions,
  stockStatusMeta,
  typeMeta,
  typeOptions,
} from '../_data';

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

const priceTypeOptions = [
  { value: 'fixed', label: 'Sabit Fiyat' },
  { value: 'rental', label: 'Kiralık' },
  { value: 'offer_based', label: 'Teklife Bağlı' },
];

const stockOptions = [
  { value: 'in_stock', label: 'Stokta' },
  { value: 'out_of_stock', label: 'Stok Yok' },
  { value: 'limited', label: 'Sınırlı' },
  { value: 'preorder', label: 'Ön Sipariş' },
];

const shippingPriceModeOptions = [
  { value: 'free', label: 'Ücretsiz' },
  { value: 'paid', label: 'Ücretli' },
  { value: 'free_over_threshold', label: 'Tutar Üzeri Ücretsiz' },
];

function buildEditForm(product) {
  return {
    title: product?.title || '',
    sku: product?.sku || '',
    brand: product?.brand || '',
    type: product?.type || 'product',
    status: product?.status || 'draft',
    pricetype: product?.pricetype || 'fixed',
    priceAmount: product?.priceAmount ?? '',
    currency: product?.currency || 'TRY',
    categories: Array.isArray(product?.categories)
      ? product.categories.join(', ')
      : '',
    summary: product?.summary || '',
    description: product?.description || '',
    admin_aprove: product?.admin_aprove !== false,
    reason: product?.reason || '',
    notifyOwner: false,
    stockStatus: product?.stock?.status || 'in_stock',
    stockQuantity: product?.stock?.quantity ?? '',
    shippingShippable: product?.shipping?.shippable !== false,
    shippingPriceMode: product?.shipping?.priceMode || 'free',
    shippingPrice: product?.shipping?.price ?? '',
    shippingFreeOverAmount: product?.shipping?.freeOverAmount ?? '',
  };
}

function parseOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitCategories(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mutationMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.normalizedMessage ||
    error?.message ||
    fallback
  );
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
  const [editForm, setEditForm] = useState(() => buildEditForm(null));
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (product) setEditForm(buildEditForm(product));
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
    const title = editForm.title.trim();
    const sku = editForm.sku.trim();
    const reason = editForm.reason.trim();
    if (!title || title.length < 2) {
      setNotice({
        variant: 'destructive',
        title: 'Form eksik',
        description: 'Başlık en az 2 karakter olmalı.',
      });
      return;
    }
    if (!sku || sku.length < 2) {
      setNotice({
        variant: 'destructive',
        title: 'Form eksik',
        description: 'SKU en az 2 karakter olmalı.',
      });
      return;
    }
    if (!editForm.admin_aprove && !reason) {
      setNotice({
        variant: 'destructive',
        title: 'Durdurma nedeni gerekli',
        description: 'Admin ürünü/hizmeti durdururken reason alanı zorunludur.',
      });
      return;
    }

    const payload = {
      id,
      title,
      sku,
      brand: editForm.brand.trim(),
      type: editForm.type,
      status: editForm.status,
      pricetype: editForm.pricetype,
      priceAmount: parseOptionalNumber(editForm.priceAmount),
      currency: editForm.currency.trim().toUpperCase() || 'TRY',
      categories: splitCategories(editForm.categories),
      summary: editForm.summary.trim(),
      description: editForm.description.trim(),
      admin_aprove: editForm.admin_aprove,
      reason,
      notifyOwner: editForm.notifyOwner,
    };

    if (editForm.type === 'product') {
      payload.stock = {
        status: editForm.stockStatus,
        quantity: parseOptionalNumber(editForm.stockQuantity) ?? 0,
      };
      payload.shipping = {
        shippable: editForm.shippingShippable,
        priceMode: editForm.shippingPriceMode,
        price: parseOptionalNumber(editForm.shippingPrice) ?? 0,
        freeOverAmount:
          parseOptionalNumber(editForm.shippingFreeOverAmount) ?? 0,
      };
    }

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
  const pt = pricetypeMeta[product.pricetype];
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
  const basePrices = Array.isArray(product.basePrice)
    ? product.basePrice.filter((p) => p && typeof p === 'object')
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

        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            if (!isUpdating) setEditOpen(open);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl">
            <form onSubmit={handleEditSubmit} className="flex min-h-0 flex-col">
              <DialogHeader>
                <DialogTitle>Ürün / Hizmet Düzenle</DialogTitle>
              </DialogHeader>
              <DialogBody className="max-h-[65vh] overflow-y-auto pr-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Başlık
                    </span>
                    <Input
                      value={editForm.title}
                      onChange={(e) => setField('title', e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      SKU
                    </span>
                    <Input
                      value={editForm.sku}
                      onChange={(e) => setField('sku', e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Tür
                    </span>
                    <Select
                      value={editForm.type}
                      onValueChange={(value) => setField('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tür" />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions
                          .filter((o) => o.value !== 'all')
                          .map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Durum
                    </span>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setField('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Durum" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions
                          .filter((o) => o.value !== 'all')
                          .map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Fiyat Tipi
                    </span>
                    <Select
                      value={editForm.pricetype}
                      onValueChange={(value) => setField('pricetype', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Fiyat tipi" />
                      </SelectTrigger>
                      <SelectContent>
                        {priceTypeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Birim Fiyat
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.priceAmount}
                      onChange={(e) => setField('priceAmount', e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Para Birimi
                    </span>
                    <Input
                      value={editForm.currency}
                      onChange={(e) => setField('currency', e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Marka
                    </span>
                    <Input
                      value={editForm.brand}
                      onChange={(e) => setField('brand', e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Kategoriler
                    </span>
                    <Input
                      value={editForm.categories}
                      onChange={(e) => setField('categories', e.target.value)}
                      placeholder="Virgül ile ayırın"
                    />
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Özet
                    </span>
                    <textarea
                      value={editForm.summary}
                      onChange={(e) => setField('summary', e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Açıklama
                    </span>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setField('description', e.target.value)}
                      rows={5}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </label>
                </div>

                {editForm.type === 'product' && (
                  <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Stok Durumu
                      </span>
                      <Select
                        value={editForm.stockStatus}
                        onValueChange={(value) =>
                          setField('stockStatus', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Stok" />
                        </SelectTrigger>
                        <SelectContent>
                          {stockOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Stok Miktarı
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={editForm.stockQuantity}
                        onChange={(e) =>
                          setField('stockQuantity', e.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Kargo Ücret Modeli
                      </span>
                      <Select
                        value={editForm.shippingPriceMode}
                        onValueChange={(value) =>
                          setField('shippingPriceMode', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Kargo" />
                        </SelectTrigger>
                        <SelectContent>
                          {shippingPriceModeOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Kargo Ücreti
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.shippingPrice}
                        onChange={(e) =>
                          setField('shippingPrice', e.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Ücretsiz Kargo Eşiği
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.shippingFreeOverAmount}
                        onChange={(e) =>
                          setField('shippingFreeOverAmount', e.target.value)
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.shippingShippable}
                        onChange={(e) =>
                          setField('shippingShippable', e.target.checked)
                        }
                        className="size-4"
                      />
                      Kargoya uygun
                    </label>
                  </div>
                )}

                <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.admin_aprove}
                      onChange={(e) =>
                        setField('admin_aprove', e.target.checked)
                      }
                      className="size-4"
                    />
                    Admin onaylı
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.notifyOwner}
                      onChange={(e) =>
                        setField('notifyOwner', e.target.checked)
                      }
                      className="size-4"
                    />
                    Kaydedince kullanıcıya mail gönder
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Reason
                    </span>
                    <textarea
                      value={editForm.reason}
                      onChange={(e) => setField('reason', e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </label>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={isUpdating}
                >
                  Vazgeç
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Kaydet
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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

        {/* Fiyatlandırma */}
        <Card>
          <CardHeader>
            <CardTitle>Fiyatlandırma</CardTitle>
            <CardToolbar>
              <Badge variant="muted">{pt?.label ?? product.pricetype}</Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <InfoRow
                icon={Wallet}
                label="Birim Fiyat"
                value={formatPrice(product.priceAmount, product.currency)}
              />
              <InfoRow
                icon={Wallet}
                label="Para Birimi"
                value={product.currency || 'TRY'}
              />
            </div>
            {basePrices.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Tanımlı Fiyatlar
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Liste Fiyatı</TableHead>
                      <TableHead>İndirim</TableHead>
                      <TableHead>İndirimli</TableHead>
                      <TableHead>Para Birimi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {basePrices.map((bp, i) => (
                      <TableRow key={bp._id || i}>
                        <TableCell>
                          {formatPrice(bp.originalPrice, bp.currency)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {bp.discountRate ? `%${bp.discountRate}` : '—'}
                        </TableCell>
                        <TableCell>
                          {formatPrice(bp.discountedPrice, bp.currency)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {bp.currency || 'TRY'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

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

        {/* Görseller */}
        {galleryImages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Görseller</CardTitle>
              <CardToolbar>
                <Badge variant="muted">{galleryImages.length} görsel</Badge>
              </CardToolbar>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {galleryImages.map((img, i) => {
                  const url = resolveImageUrl(
                    img?.path || img?.variants?.[0]?.url,
                  );
                  return (
                    <div
                      key={img?._id || i}
                      className="aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={img?.alt || product.title}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="size-5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Hizmet / Rezervasyon ayarları */}
        {(timeR.enabled || reservation.enabled) && (
          <Card>
            <CardHeader>
              <CardTitle>Hizmet & Rezervasyon</CardTitle>
              <CardToolbar>
                <CalendarClock className="size-4 text-muted-foreground" />
              </CardToolbar>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
              {timeR.enabled && (
                <>
                  <InfoRow
                    icon={CalendarClock}
                    label="Randevu Saatleri"
                    value={
                      timeR.allDay
                        ? 'Tüm gün'
                        : [timeR.dailyStartTime, timeR.dailyEndTime]
                            .filter(Boolean)
                            .join(' – ') || '—'
                    }
                  />
                  <InfoRow
                    icon={CalendarClock}
                    label="Slot Süresi (dk)"
                    value={
                      timeR.slotDurationMinutes != null
                        ? String(timeR.slotDurationMinutes)
                        : '—'
                    }
                  />
                  {Array.isArray(timeR.days) && timeR.days.length > 0 && (
                    <div className="sm:col-span-2">
                      <InfoRow label="Günler" value={timeR.days.join(', ')} />
                    </div>
                  )}
                </>
              )}
              {reservation.enabled && (
                <>
                  <InfoRow
                    icon={CalendarClock}
                    label="Fiyatlandırma Birimi"
                    value={reservation.pricingUnit}
                  />
                  <InfoRow
                    icon={CalendarClock}
                    label="Kapasite"
                    value={
                      reservation.capacity != null
                        ? String(reservation.capacity)
                        : '—'
                    }
                  />
                  <InfoRow
                    icon={CalendarClock}
                    label="Min. Süre"
                    value={
                      reservation.minDuration != null
                        ? String(reservation.minDuration)
                        : '—'
                    }
                  />
                  <InfoRow
                    icon={CalendarClock}
                    label="Maks. Süre"
                    value={
                      reservation.maxDuration != null
                        ? String(reservation.maxDuration)
                        : '—'
                    }
                  />
                </>
              )}
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
