'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useAddCmsServiceCategoryAttributeMutation,
  useCreateCmsServiceCategoryMutation,
  useDeleteCmsServiceCategoryAttributeMutation,
  useDeleteCmsServiceCategoryMutation,
  useGetCmsServiceCategoriesQuery,
  useGetCmsServiceCategoryProductsQuery,
  useUpdateCmsServiceCategoryMutation,
} from '@/redux/services';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { canAccess, CMS_ROLES } from '@/lib/roles';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  DialogDescription,
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

const PAGE_SIZE = 10;
const PRODUCT_PAGE_SIZE = 8;

const SERVICE_TYPES = [
  { value: 'direct', label: 'Doğrudan satış' },
  { value: 'quote', label: 'Teklif' },
  { value: 'rental', label: 'Kiralama' },
  { value: 'slot', label: 'Randevu / rezervasyon' },
];

const ATTRIBUTE_INPUTS = [
  { value: 'text', label: 'Metin' },
  { value: 'number', label: 'Sayı' },
  { value: 'select', label: 'Tekli seçim' },
  { value: 'multiselect', label: 'Çoklu seçim' },
  { value: 'boolean', label: 'Evet / Hayır' },
  { value: 'date', label: 'Tarih' },
  { value: 'color', label: 'Renk' },
];

const CATEGORY_SORTS = [
  { value: 'sortOrder:asc', label: 'Sıra: artan' },
  { value: 'sortOrder:desc', label: 'Sıra: azalan' },
  { value: 'name:asc', label: 'Ad: A–Z' },
  { value: 'name:desc', label: 'Ad: Z–A' },
  { value: 'productCount:desc', label: 'En çok hizmet' },
  { value: 'createdAt:desc', label: 'En yeni' },
];

const PRODUCT_SORTS = [
  { value: 'createdAt:desc', label: 'En yeni' },
  { value: 'createdAt:asc', label: 'En eski' },
  { value: 'title:asc', label: 'Ad: A–Z' },
  { value: 'title:desc', label: 'Ad: Z–A' },
  { value: 'status:asc', label: 'Durum' },
];

const PRODUCT_STATUSES = [
  { value: 'all', label: 'Tüm durumlar' },
  { value: 'active', label: 'Aktif' },
  { value: 'draft', label: 'Taslak' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'inactive', label: 'Pasif' },
  { value: 'rejected', label: 'Reddedildi' },
];

const statusMeta = {
  active: { label: 'Aktif', variant: 'success' },
  inactive: { label: 'Pasif', variant: 'muted' },
  draft: { label: 'Taslak', variant: 'muted' },
  pending: { label: 'Beklemede', variant: 'warning' },
  rejected: { label: 'Reddedildi', variant: 'destructive' },
};

const emptyCategoryForm = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  businessLineId: '',
  serviceTypes: ['direct'],
  status: 'active',
  sortOrder: 0,
};

const emptyAttributeForm = {
  code: '',
  label: '',
  input: 'text',
  options: '',
  unit: '',
  required: false,
};

const errorMessage = (error, fallback) =>
  error?.data?.message || error?.normalizedMessage || fallback;

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('tr-TR');
};

function Field({ label, children, hint, className = '' }) {
  return (
    <label
      className={`grid gap-1.5 text-sm font-medium text-foreground ${className}`}
    >
      <span>{label}</span>
      {children}
      {hint && (
        <span className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

function CategoryDialog({ open, category, onOpenChange, onSaved }) {
  const editing = Boolean(category?.id);
  const [form, setForm] = useState(emptyCategoryForm);
  const [formError, setFormError] = useState('');
  const [createCategory, { isLoading: isCreating }] =
    useCreateCmsServiceCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] =
    useUpdateCmsServiceCategoryMutation();
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    if (!open) return;
    setForm(
      category
        ? {
            name: category.name || '',
            slug: category.slug || '',
            description: category.description || '',
            icon: category.icon || '',
            businessLineId: category.businessLineId || '',
            serviceTypes: category.serviceTypes?.length
              ? category.serviceTypes
              : ['direct'],
            status: category.status || 'active',
            sortOrder: category.sortOrder ?? 0,
          }
        : emptyCategoryForm,
    );
    setFormError('');
  }, [category, open]);

  const setValue = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggleServiceType = (value) => {
    setForm((current) => ({
      ...current,
      serviceTypes: current.serviceTypes.includes(value)
        ? current.serviceTypes.filter((item) => item !== value)
        : [...current.serviceTypes, value],
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setFormError('');
    if (form.name.trim().length < 2) {
      setFormError('Kategori adı en az 2 karakter olmalı.');
      return;
    }
    if (!form.serviceTypes.length) {
      setFormError('En az bir hizmet tipi seçin.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon.trim(),
      businessLineId: form.businessLineId.trim(),
      serviceTypes: form.serviceTypes,
      status: form.status,
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (!editing) payload.slug = form.slug.trim() || form.name.trim();
    try {
      if (editing)
        await updateCategory({ id: category.id, ...payload }).unwrap();
      else await createCategory(payload).unwrap();
      onSaved(editing ? 'Kategori güncellendi.' : 'Kategori oluşturuldu.');
      onOpenChange(false);
    } catch (error) {
      setFormError(errorMessage(error, 'Kategori kaydedilemedi.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Kategoriyi düzenle' : 'Yeni hizmet kategorisi'}
            </DialogTitle>
            <DialogDescription>
              Sistem hizmet kataloğunda firmaların ürün eklerken seçebileceği
              alanı tanımlayın.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {formError && (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <Field label="Kategori adı">
              <Input
                value={form.name}
                onChange={(e) => setValue('name', e.target.value)}
                required
              />
            </Field>
            <Field
              label="Slug"
              hint={
                editing
                  ? 'Kimlik bütünlüğü için sonradan değiştirilemez.'
                  : 'Boşsa addan otomatik üretilir.'
              }
            >
              <Input
                value={form.slug}
                onChange={(e) => setValue('slug', e.target.value)}
                disabled={editing}
                placeholder="ornek-hizmet"
              />
            </Field>
            <Field label="İkon" hint="Emoji veya kısa ikon değeri">
              <Input
                value={form.icon}
                onChange={(e) => setValue('icon', e.target.value)}
                placeholder="🧩"
              />
            </Field>
            <Field label="İş kolu kimliği" hint="Örn. softwareDigitalServices">
              <Input
                value={form.businessLineId}
                onChange={(e) => setValue('businessLineId', e.target.value)}
                placeholder="businessLineId"
              />
            </Field>
            <Field label="Durum">
              <Select
                value={form.status}
                onValueChange={(value) => setValue('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sıra">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setValue('sortOrder', e.target.value)}
              />
            </Field>
            <Field label="Açıklama" className="sm:col-span-2">
              <textarea
                value={form.description}
                onChange={(e) => setValue('description', e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              />
            </Field>
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">
                Hizmet tipleri
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICE_TYPES.map((item) => (
                  <label
                    key={item.value}
                    className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.serviceTypes.includes(item.value)}
                      onChange={() => toggleServiceType(item.value)}
                      className="size-4"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AttributesDialog({ category, onOpenChange, onChanged }) {
  const open = Boolean(category);
  const [form, setForm] = useState(emptyAttributeForm);
  const [formError, setFormError] = useState('');
  const [addAttribute, { isLoading: isAdding }] =
    useAddCmsServiceCategoryAttributeMutation();
  const [deleteAttribute, { isLoading: isDeleting }] =
    useDeleteCmsServiceCategoryAttributeMutation();

  useEffect(() => {
    if (open) {
      setForm(emptyAttributeForm);
      setFormError('');
    }
  }, [category?.id, open]);

  const add = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      await addAttribute({
        id: category.id,
        ...form,
        options: form.options
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }).unwrap();
      setForm(emptyAttributeForm);
      onChanged('Özellik eklendi.');
    } catch (error) {
      setFormError(errorMessage(error, 'Özellik eklenemedi.'));
    }
  };

  const remove = async (attribute) => {
    const confirmed = window.confirm(
      `“${attribute.label}” kategori şemasından kalıcı olarak kaldırılacak. Ürünlerdeki eski ham değerler veri güvenliği için korunur fakat artık kategori özelliği olarak hesaplanmaz. Devam edilsin mi?`,
    );
    if (!confirmed) return;
    setFormError('');
    try {
      await deleteAttribute({ id: category.id, code: attribute.code }).unwrap();
      onChanged('Özellik kalıcı olarak kaldırıldı.');
    } catch (error) {
      setFormError(errorMessage(error, 'Özellik kaldırılamadı.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(null)}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category?.name} · Özellikler</DialogTitle>
          <DialogDescription>
            Bu alanlar hizmetin ürün özellikleridir; müşteri talep formu
            soruları değildir.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiket</TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Zorunlu</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {category?.attributes?.length ? (
                  category.attributes.map((attribute) => (
                    <TableRow key={attribute.code}>
                      <TableCell className="font-medium">
                        {attribute.label}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {attribute.code}
                      </TableCell>
                      <TableCell>
                        {ATTRIBUTE_INPUTS.find(
                          (item) => item.value === attribute.input,
                        )?.label || attribute.input}
                      </TableCell>
                      <TableCell>
                        {attribute.required ? 'Evet' : 'Hayır'}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(attribute)}
                          disabled={isDeleting}
                          aria-label={`${attribute.label} özelliğini kaldır`}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Henüz özellik yok.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <form
            onSubmit={add}
            className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2"
          >
            <h3 className="font-semibold sm:col-span-2">Yeni özellik</h3>
            <Field label="Etiket">
              <Input
                value={form.label}
                onChange={(e) =>
                  setForm((v) => ({ ...v, label: e.target.value }))
                }
                required
              />
            </Field>
            <Field label="Kod" hint="Örn. experience_years">
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm((v) => ({ ...v, code: e.target.value }))
                }
                required
              />
            </Field>
            <Field label="Tip">
              <Select
                value={form.input}
                onValueChange={(input) => setForm((v) => ({ ...v, input }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTRIBUTE_INPUTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Birim" hint="Opsiyonel: yıl, m², kişi...">
              <Input
                value={form.unit}
                onChange={(e) =>
                  setForm((v) => ({ ...v, unit: e.target.value }))
                }
              />
            </Field>
            {(form.input === 'select' || form.input === 'multiselect') && (
              <Field label="Seçenekler" hint="Virgülle ayırın">
                <Input
                  value={form.options}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, options: e.target.value }))
                  }
                  required
                />
              </Field>
            )}
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) =>
                  setForm((v) => ({ ...v, required: e.target.checked }))
                }
                className="size-4"
              />
              Ürün eklerken zorunlu
            </label>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={isAdding}>
                {isAdding ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Özellik ekle
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ProductsDialog({ category, onOpenChange }) {
  const open = Boolean(category);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSearch('');
    setSubmittedSearch('');
    setStatus('all');
    setSort('createdAt:desc');
    setPage(1);
  }, [category?.id]);
  useEffect(() => setPage(1), [submittedSearch, status, sort]);

  const [sortField, order] = sort.split(':');
  const { data, isLoading, isFetching, error } =
    useGetCmsServiceCategoryProductsQuery(
      {
        id: category?.id || '',
        query: submittedSearch || undefined,
        status: status === 'all' ? undefined : status,
        sort: sortField,
        order,
        page,
        limit: PRODUCT_PAGE_SIZE,
      },
      { skip: !open },
    );
  const products = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(null)}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category?.name} · Bağlı ürün ve hizmetler</DialogTitle>
          <DialogDescription>
            Kategoriye Mongo kimliği veya eski slug/external ID ile bağlanmış
            kayıtların tamamı.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="ps-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && setSubmittedSearch(search.trim())
                }
                placeholder="Ürün/hizmet adı veya SKU..."
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setSubmittedSearch(search.trim())}
            >
              Ara
            </Button>
            <div className="w-40">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_SORTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(error, 'Bağlı kayıtlar yüklenemedi.')}
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-lg border border-border">
              {isFetching && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-background/60">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün / Hizmet</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length ? (
                    products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <p className="font-medium">{product.title}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {product.sku}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {product.type === 'services' ? 'Hizmet' : 'Ürün'}
                          </Badge>
                        </TableCell>
                        <TableCell>{product.company?.name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={statusMeta[product.status]?.variant}>
                            {statusMeta[product.status]?.label ||
                              product.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(product.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              window.open(
                                `/cms/products/${product.id}`,
                                '_blank',
                              )
                            }
                            aria-label="Kaydı aç"
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Bağlı ürün veya hizmet bulunamadı.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {data?.total || 0} kayıt · Sayfa {page}/{totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((v) => v - 1)}
                  >
                    <ChevronLeft className="size-4" /> Önceki
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage((v) => v + 1)}
                  >
                    Sonraki <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function CmsCategoriesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [serviceType, setServiceType] = useState('all');
  const [sort, setSort] = useState('sortOrder:asc');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [attributesCategoryId, setAttributesCategoryId] = useState(null);
  const [productsCategoryId, setProductsCategoryId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [deleteCategory, { isLoading: isDeleting }] =
    useDeleteCmsServiceCategoryMutation();

  useEffect(() => setPage(1), [submittedSearch, status, serviceType, sort]);
  const [sortField, order] = sort.split(':');
  const { data, isLoading, isFetching, error } =
    useGetCmsServiceCategoriesQuery(
      {
        query: submittedSearch || undefined,
        status: status === 'all' ? undefined : status,
        serviceType: serviceType === 'all' ? undefined : serviceType,
        sort: sortField,
        order,
        page,
        limit: PAGE_SIZE,
      },
      { skip: !authorized },
    );
  const categories = data?.items || [];
  const totalPages = data?.totalPages || 1;
  const attributesCategory = useMemo(
    () => categories.find((item) => item.id === attributesCategoryId) || null,
    [attributesCategoryId, categories],
  );
  const productsCategory = useMemo(
    () => categories.find((item) => item.id === productsCategoryId) || null,
    [productsCategoryId, categories],
  );

  const openCreate = () => {
    setEditingCategory(null);
    setFormOpen(true);
  };
  const openEdit = (category) => {
    setEditingCategory(category);
    setFormOpen(true);
  };
  const showSuccess = (message) =>
    setNotice({
      variant: 'info',
      title: 'İşlem tamamlandı',
      description: message,
    });
  const remove = async (category) => {
    if (category.productCount > 0) return;
    if (
      !window.confirm(
        `“${category.name}” kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
      )
    )
      return;
    try {
      await deleteCategory(category.id).unwrap();
      showSuccess('Kategori kalıcı olarak silindi.');
    } catch (deleteError) {
      setNotice({
        variant: 'destructive',
        title: 'Kategori silinemedi',
        description: errorMessage(
          deleteError,
          'Kategori silinirken hata oluştu.',
        ),
      });
    }
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Partnerler"
        title="Hizmet Kategorileri"
        description="Sistem hizmet kategorilerini, bağlı hizmetleri ve ürün özelliklerini yönetin"
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Yeni kategori
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && setSubmittedSearch(search.trim())
              }
              placeholder="Ad, slug veya iş kolu kimliği..."
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setSubmittedSearch(search.trim())}
            disabled={isFetching}
          >
            <Search className="size-4" /> Ara
          </Button>
          <div className="w-36">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm hizmet tipleri</SelectItem>
                {SERVICE_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_SORTS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {notice && (
        <Alert variant={notice.variant} className="mb-5">
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kategori Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{data?.total || 0} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="relative px-0 py-0">
          {isFetching && !isLoading && !error && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-background/60">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Kategoriler yüklenemedi</AlertTitle>
                <AlertDescription>
                  {errorMessage(error, 'Sunucuya ulaşılamadı.')}
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !categories.length ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Tags className="size-7 text-muted-foreground" />
              <p className="font-semibold">Kategori bulunamadı</p>
              <p className="text-sm text-muted-foreground">
                Filtreleri değiştirin veya yeni kategori ekleyin.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Hizmet tipleri</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Özellik</TableHead>
                      <TableHead>Bağlı hizmet</TableHead>
                      <TableHead>Sıra</TableHead>
                      <TableHead>Güncelleme</TableHead>
                      <TableHead className="w-36">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 place-items-center rounded-lg bg-muted text-lg">
                              {category.icon || '🏷️'}
                            </span>
                            <div>
                              <p className="font-medium">{category.name}</p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {category.slug}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-56 flex-wrap gap-1">
                            {category.serviceTypes.map((type) => (
                              <Badge key={type} variant="outline">
                                {SERVICE_TYPES.find(
                                  (item) => item.value === type,
                                )?.label || type}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusMeta[category.status]?.variant}
                            dot
                          >
                            {statusMeta[category.status]?.label ||
                              category.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAttributesCategoryId(category.id)}
                          >
                            <SlidersHorizontal className="size-4" />{' '}
                            {category.attributeCount}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setProductsCategoryId(category.id)}
                          >
                            <Eye className="size-4" /> {category.productCount}
                          </Button>
                        </TableCell>
                        <TableCell>{category.sortOrder}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(category.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(category)}
                              aria-label="Kategoriyi düzenle"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => remove(category)}
                              disabled={isDeleting || category.productCount > 0}
                              title={
                                category.productCount > 0
                                  ? 'Önce bağlı hizmetlerin kategorisini değiştirin'
                                  : 'Kategoriyi kalıcı sil'
                              }
                              aria-label="Kategoriyi sil"
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Sayfa {page} / {totalPages} · Toplam {data?.total || 0} kayıt
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((v) => v - 1)}
                  >
                    <ChevronLeft className="size-4" /> Önceki
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage((v) => v + 1)}
                  >
                    Sonraki <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CategoryDialog
        open={formOpen}
        category={editingCategory}
        onOpenChange={setFormOpen}
        onSaved={showSuccess}
      />
      <AttributesDialog
        category={attributesCategory}
        onOpenChange={setAttributesCategoryId}
        onChanged={showSuccess}
      />
      <ProductsDialog
        category={productsCategory}
        onOpenChange={setProductsCategoryId}
      />
    </RoleGuard>
  );
}
