'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Building2, ChevronLeft, Loader2, Save } from 'lucide-react';
import { canAccess, CMS_ROLES } from '@/lib/roles';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateCmsProductMutation,
  useGetCompanyQuery,
} from '@/redux/services';
import { ProductCoreFields } from '../_form/ProductCoreFields';
import {
  buildProductForm,
  extractLimitPayload,
  mutationMessage,
  toCreatePayload,
  validateProductForm,
} from '../_form/productFormModel';

/**
 * Firma adına ürün / hizmet oluşturma.
 *
 * Giriş noktası firma detayındaki "Ürünler / Hizmetler" sekmesi
 * (`/cms/companies/:id` → ?companyId=). Ayrı route olmasının sebebi: firma
 * sayfasındaki sekme state'i URL'e bağlı olsa da çok bölümlü bir form dialog
 * içinde yenilemeye dayanmıyor.
 *
 * Kayıttan sonra `/cms/products/<id>` sayfasına yönlendirir — konum, formlar ve
 * zamanlama bölümleri zaten orada yaşıyor.
 */

function CreateProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId') || '';

  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const {
    data: company,
    isLoading: companyLoading,
    error: companyError,
  } = useGetCompanyQuery(companyId, { skip: !authorized || !companyId });

  const [createCmsProduct, { isLoading: isCreating }] =
    useCreateCmsProductMutation();

  // Oluşturmada durum daima 'draft'; admin alanları yok. buildProductForm(null)
  // varsayılanları zaten bunu verir.
  const [form, setForm] = useState(() => buildProductForm(null));
  const [notice, setNotice] = useState(null);
  const [limitInfo, setLimitInfo] = useState(null);

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const companyName = useMemo(
    () => company?.name || company?.title || company?.companyName || companyId,
    [company, companyId],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice(null);
    setLimitInfo(null);

    // SKU create'te backend'de üretiliyor (resolveSku) → zorunlu değil.
    const validationError = validateProductForm(form, { requireSku: false });
    if (validationError) {
      setNotice({
        variant: 'destructive',
        title: 'Form eksik',
        description: validationError,
      });
      return;
    }

    try {
      // Tip matrisi (catalogProduct:false, hizmette stock/shipping'in
      // çıkarılması, quote'ta fiyatın gönderilmemesi) toCreatePayload'da.
      const created = await createCmsProduct(
        toCreatePayload(form, companyId),
      ).unwrap();

      const newId = created?._id || created?.id;
      if (newId) {
        router.push(`/cms/products/${newId}`);
        return;
      }

      // Backend 2xx döndü ama ürün kimliği okunamadı (bkz. productsApi.js
      // extractCreatedProduct). Kayıt oluştu; kullanıcıyı listeye taşı.
      setNotice({
        variant: 'info',
        title: 'Kayıt oluşturuldu',
        description:
          'Ürün oluşturuldu ancak kimliği yanıttan okunamadı. Listeden açabilirsiniz.',
      });
    } catch (err) {
      const limit = extractLimitPayload(err);
      if (limit) {
        setLimitInfo(limit);
        return;
      }
      setNotice({
        variant: 'destructive',
        title: 'Oluşturulamadı',
        description: mutationMessage(err, 'Ürün oluşturulurken hata oluştu.'),
      });
    }
  };

  if (!companyId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Firma seçilmedi</AlertTitle>
        <AlertDescription>
          Bu sayfa bir firma bağlamı gerektirir. Firma detayındaki “Ürünler /
          Hizmetler” sekmesinden “Ürün / Hizmet Ekle” ile açın.
        </AlertDescription>
      </Alert>
    );
  }

  if (companyLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (companyError || !company) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Firma bulunamadı</AlertTitle>
        <AlertDescription>
          {mutationMessage(companyError, 'Firma bilgisi yüklenemedi.')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Building2 className="size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Firma adına ekleniyor</p>
              <Link
                href={`/cms/companies/${companyId}?section=urunler`}
                className="text-sm font-medium text-foreground hover:text-primary"
              >
                {companyName}
              </Link>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Kayıt <span className="font-medium text-foreground">taslak</span>{' '}
            olarak oluşturulur.
          </p>
        </CardContent>
      </Card>

      {limitInfo && (
        <Alert variant="destructive">
          <AlertTitle>Firmanın kotası dolu</AlertTitle>
          <AlertDescription>
            {limitInfo.limitType === 'services.amount' ? 'Hizmet' : 'Ürün'}{' '}
            limiti dolu ({limitInfo.usage ?? '—'}/{limitInfo.limit ?? '—'}).{' '}
            <Link
              href={`/cms/companies/${companyId}?section=limitler`}
              className="font-medium text-primary hover:underline"
            >
              Limitleri düzenle
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant={notice.variant === 'destructive' ? 'destructive' : 'info'}>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ürün / Hizmet Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ProductCoreFields
            form={form}
            setField={setField}
            mode="create"
            disabled={isCreating}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(`/cms/companies/${companyId}?section=urunler`)
          }
          disabled={isCreating}
        >
          Vazgeç
        </Button>
        <Button type="submit" disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Oluştur
        </Button>
      </div>
    </form>
  );
}

export default function CmsProductCreatePage() {
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[
          { label: 'Firmalar', href: '/cms/companies' },
          { label: 'Yeni Ürün / Hizmet' },
        ]}
        title="Yeni Ürün / Hizmet"
        description="Seçili firma adına ürün veya hizmet oluşturun."
        actions={
          <Link
            href="/cms/products"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ChevronLeft className="size-4" />
            Listeye dön
          </Link>
        }
      />
      {/* useSearchParams CSR bailout gerektirir. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CreateProductForm />
      </Suspense>
    </RoleGuard>
  );
}
