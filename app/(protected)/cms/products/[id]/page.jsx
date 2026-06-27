'use client';

import { use } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Package, Hash, Tag, Building2, Layers, Boxes, Image as ImageIcon,
  ListChecks, CalendarClock, Truck, ExternalLink, Wallet,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/page-shell';
import {
  Card, CardContent, CardHeader, CardTitle, CardToolbar,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { API_HOST } from '@/config/api';
import { useGetCmsProductQuery } from '@/redux/services';
import {
  typeMeta, statusMeta, pricetypeMeta, stockStatusMeta, formatPrice,
} from '../_data';

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {value || '—'} <ExternalLink className="size-3" />
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground break-words">{value || '—'}</p>
        )}
      </div>
    </div>
  );
}

export default function CmsProductDetailPage({ params }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const { data: product, isLoading, error } = useGetCmsProductQuery(id, { skip: !authorized });

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader breadcrumb={[{ label: 'Ürünler & Hizmetler', href: '/cms/products' }, { label: '…' }]} title="Yükleniyor…" />
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
        <PageHeader breadcrumb={[{ label: 'Ürünler & Hizmetler', href: '/cms/products' }, { label: 'Bulunamadı' }]} title="Ürün Bulunamadı" />
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {error ? (error?.data?.message || error?.normalizedMessage || 'Yükleme hatası.') : 'Bu ürün bulunamadı.'}{' '}
            <Link href="/cms/products" className="text-primary hover:underline">Listeye dön</Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  const t = typeMeta[product.type];
  const s = statusMeta[product.status];
  const pt = pricetypeMeta[product.pricetype];
  const company = product.companyid && typeof product.companyid === 'object' ? product.companyid : null;
  const categories = Array.isArray(product.categories) ? product.categories.filter(Boolean) : [];
  const attributes = Array.isArray(product.attributes) ? product.attributes : [];
  const basePrices = Array.isArray(product.basePrice) ? product.basePrice.filter((p) => p && typeof p === 'object') : [];
  const galleryImages = Array.isArray(product.gallery?.images) ? product.gallery.images : [];
  const isProduct = product.type === 'product';
  const stock = product.stock || {};
  const stockMeta = stockStatusMeta[stock.status];
  const shipping = product.shipping || {};
  const timeR = product.timeRestriction || {};
  const reservation = product.reservationConfig || {};

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[{ label: 'Ürünler & Hizmetler', href: '/cms/products' }, { label: product.title }]}
        title={product.title}
      />

      <div className="space-y-5">
        {/* Üst başlık kartı */}
        <Card>
          <CardContent className="flex flex-wrap items-start gap-4 p-5">
            <Avatar name={product.title} src={resolveImageUrl(product.coverImage) || undefined} size="lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{product.title}</h2>
                {t && <Badge variant={t.variant}>{t.label}</Badge>}
                {s && <Badge variant={s.variant}>{s.label}</Badge>}
                {pt && <Badge variant={pt.variant}>{pt.label}</Badge>}
              </div>
              <p className="font-mono text-xs text-muted-foreground">SKU: {product.sku || '—'}</p>
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
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Fiyat</p>
              <p className="text-lg font-semibold text-foreground">{formatPrice(product.priceAmount, product.currency)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Genel bilgiler */}
        <Card>
          <CardHeader><CardTitle>Genel Bilgiler</CardTitle></CardHeader>
          <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
            <InfoRow icon={Package} label="Başlık" value={product.title} />
            <InfoRow icon={Hash} label="SKU" value={product.sku} />
            <InfoRow icon={Hash} label="Slug" value={product.slug} />
            <InfoRow icon={Tag} label="Marka" value={product.brand} />
            <InfoRow icon={Layers} label="Tür" value={t?.label ?? product.type} />
            <InfoRow icon={Boxes} label="Fiyat Tipi" value={pt?.label ?? product.pricetype} />
            <InfoRow icon={CalendarClock} label="Oluşturulma" value={formatTrDate(product.createdAt)} />
            <InfoRow icon={CalendarClock} label="Güncellenme" value={formatTrDate(product.updatedAt)} />
            {product.summary && (
              <div className="sm:col-span-2"><InfoRow label="Özet" value={product.summary} /></div>
            )}
            {product.description && (
              <div className="sm:col-span-2"><InfoRow label="Açıklama" value={product.description} /></div>
            )}
            {categories.length > 0 && (
              <div className="sm:col-span-2 py-2">
                <p className="mb-1.5 text-xs text-muted-foreground">Kategoriler</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c, i) => <Badge key={i} variant="muted">{c}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fiyatlandırma */}
        <Card>
          <CardHeader>
            <CardTitle>Fiyatlandırma</CardTitle>
            <CardToolbar><Badge variant="muted">{pt?.label ?? product.pricetype}</Badge></CardToolbar>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <InfoRow icon={Wallet} label="Birim Fiyat" value={formatPrice(product.priceAmount, product.currency)} />
              <InfoRow icon={Wallet} label="Para Birimi" value={product.currency || 'TRY'} />
            </div>
            {basePrices.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs text-muted-foreground">Tanımlı Fiyatlar</p>
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
                        <TableCell>{formatPrice(bp.originalPrice, bp.currency)}</TableCell>
                        <TableCell className="text-muted-foreground">{bp.discountRate ? `%${bp.discountRate}` : '—'}</TableCell>
                        <TableCell>{formatPrice(bp.discountedPrice, bp.currency)}</TableCell>
                        <TableCell className="text-muted-foreground">{bp.currency || 'TRY'}</TableCell>
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
            <CardHeader><CardTitle>Stok</CardTitle></CardHeader>
            <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
              <div className="flex items-center gap-3 py-2">
                <Boxes className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Durum</p>
                  {stockMeta ? <Badge variant={stockMeta.variant}>{stockMeta.label}</Badge> : <p className="text-sm font-medium text-foreground">{stock.status || '—'}</p>}
                </div>
              </div>
              <InfoRow icon={Boxes} label="Miktar" value={stock.quantity != null ? String(stock.quantity) : '—'} />
            </CardContent>
          </Card>
        )}

        {/* Görseller */}
        {galleryImages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Görseller</CardTitle>
              <CardToolbar><Badge variant="muted">{galleryImages.length} görsel</Badge></CardToolbar>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {galleryImages.map((img, i) => {
                  const url = resolveImageUrl(img?.path || img?.variants?.[0]?.url);
                  return (
                    <div key={img?._id || i} className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={img?.alt || product.title} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground"><ImageIcon className="size-5" /></div>
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
              <CardToolbar><Badge variant="muted">{attributes.length} özellik</Badge></CardToolbar>
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
                      <TableCell className="font-medium">{a.label || a.key}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.value}{a.unit ? ` ${a.unit}` : ''}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.type || '—'}</TableCell>
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
              <CardToolbar><CalendarClock className="size-4 text-muted-foreground" /></CardToolbar>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
              {timeR.enabled && (
                <>
                  <InfoRow icon={CalendarClock} label="Randevu Saatleri" value={timeR.allDay ? 'Tüm gün' : [timeR.dailyStartTime, timeR.dailyEndTime].filter(Boolean).join(' – ') || '—'} />
                  <InfoRow icon={CalendarClock} label="Slot Süresi (dk)" value={timeR.slotDurationMinutes != null ? String(timeR.slotDurationMinutes) : '—'} />
                  {Array.isArray(timeR.days) && timeR.days.length > 0 && (
                    <div className="sm:col-span-2"><InfoRow label="Günler" value={timeR.days.join(', ')} /></div>
                  )}
                </>
              )}
              {reservation.enabled && (
                <>
                  <InfoRow icon={CalendarClock} label="Fiyatlandırma Birimi" value={reservation.pricingUnit} />
                  <InfoRow icon={CalendarClock} label="Kapasite" value={reservation.capacity != null ? String(reservation.capacity) : '—'} />
                  <InfoRow icon={CalendarClock} label="Min. Süre" value={reservation.minDuration != null ? String(reservation.minDuration) : '—'} />
                  <InfoRow icon={CalendarClock} label="Maks. Süre" value={reservation.maxDuration != null ? String(reservation.maxDuration) : '—'} />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Kargo (sadece ürün) */}
        {isProduct && (
          <Card>
            <CardHeader><CardTitle>Kargo</CardTitle></CardHeader>
            <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
              <InfoRow icon={Truck} label="Kargoya Uygun" value={shipping.shippable === false ? 'Hayır' : 'Evet'} />
              <InfoRow icon={Truck} label="Ücret Modeli" value={
                shipping.priceMode === 'free' ? 'Ücretsiz'
                  : shipping.priceMode === 'free_over_threshold' ? `${formatPrice(shipping.freeOverAmount, product.currency)} üzeri ücretsiz`
                    : 'Ücretli'
              } />
              {shipping.priceMode !== 'free' && (
                <InfoRow icon={Truck} label="Kargo Ücreti" value={formatPrice(shipping.price, product.currency)} />
              )}
            </CardContent>
          </Card>
        )}

        {/* Boş içerik durumu (galeri/özellik/stok hiçbiri yoksa bilgi) */}
        {!isProduct && !attributes.length && !galleryImages.length && !timeR.enabled && !reservation.enabled && (
          <EmptyState icon={<ListChecks className="size-5" />} title="Ek detay yok" description="Bu hizmet için ek özellik, görsel veya rezervasyon ayarı bulunmuyor." className="py-10" />
        )}
      </div>
    </RoleGuard>
  );
}
