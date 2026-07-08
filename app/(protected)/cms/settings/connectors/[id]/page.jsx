'use client';

/**
 * Katalog girdisi oluştur/düzenle (cms:admin).
 *
 * `new/` dizini yok: `const isNew = id === 'new'` (packages emsali).
 *
 * Üç kilit:
 *  - `authType` girdinin şeklini belirler ve OLUŞTURDUKTAN SONRA değiştirilemez.
 *  - `key` oauth2'de yazılmaz, `oauthProviderKey`'den TÜRETİLİR (backend
 *    pre("validate") atar). Kullanıcının connector'ında `providerLower` olur ve
 *    OAuth token refresh'i ona bakar → sonradan değiştirilemez.
 *  - `mcpConfig.serverUrl` formda HAM override olarak düzenlenir. Boş bırakılırsa
 *    provider.config.js'teki değer devralınır (placeholder'da gösterilir).
 *    Detay yanıtındaki `mcpConfig.serverUrl` ÇÖZÜLMÜŞ değerdir — forma o değil,
 *    `mcpConfigOverride.serverUrl` yazılır, aksi halde devralınan URL sessizce
 *    override olarak sabitlenirdi.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Save } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetCmsConnectorCatalogEntryQuery,
  useCreateConnectorCatalogEntryMutation,
  useUpdateConnectorCatalogEntryMutation,
  useGetOAuthProvidersQuery,
  useGetConnectorCategoriesQuery,
} from '@/redux/services';

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const errText = (e, fallback) =>
  e?.data?.message || e?.data?.status?.description || e?.normalizedMessage || fallback;

const EMPTY = {
  key: '', name: '', description: '', icon: '', category: '',
  authType: 'none', oauthProviderKey: '',
  serverUrl: '', transport: 'streamable_http',
  apiKeyLabel: '', instructionsUrl: '', docsUrl: '',
  status: 'draft', featured: false, sortOrder: 0,
};

function Field({ label, hint, children }) {
  return (
    <div className="min-w-[200px] flex-1">
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ConnectorCatalogEntryPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const isNew = id === 'new';

  const { data: entry, isLoading, error } = useGetCmsConnectorCatalogEntryQuery(id, {
    skip: !authorized || isNew,
  });
  const { data: providers = [] } = useGetOAuthProvidersQuery(undefined, { skip: !authorized });
  const { data: categories = [] } = useGetConnectorCategoriesQuery({}, { skip: !authorized });

  const [createEntry, { isLoading: creating }] = useCreateConnectorCatalogEntryMutation();
  const [updateEntry, { isLoading: saving }] = useUpdateConnectorCatalogEntryMutation();

  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!entry) return;
    setForm({
      key: entry.key ?? '',
      name: entry.name ?? '',
      description: entry.description ?? '',
      icon: entry.icon ?? '',
      category: entry.category ?? '',
      authType: entry.authType ?? 'none',
      oauthProviderKey: entry.oauthProviderKey ?? '',
      // ÇÖZÜLMÜŞ değil, HAM override. Boşsa "devralınıyor" demektir.
      serverUrl: entry.mcpConfigOverride?.serverUrl ?? '',
      transport: entry.mcpConfigOverride?.transport ?? 'streamable_http',
      apiKeyLabel: entry.apiKeyLabel ?? '',
      instructionsUrl: entry.instructionsUrl ?? '',
      docsUrl: entry.docsUrl ?? '',
      status: entry.status ?? 'draft',
      featured: Boolean(entry.featured),
      sortOrder: entry.sortOrder ?? 0,
    });
  }, [entry]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.key === form.oauthProviderKey) ?? null,
    [providers, form.oauthProviderKey],
  );
  const inheritedUrl = form.authType === 'oauth2' ? selectedProvider?.mcp?.serverUrl ?? null : null;
  const isOAuth = form.authType === 'oauth2';
  const serverUrlRequired = !isOAuth;

  const validate = () => {
    if (!form.name.trim()) return 'Ad zorunludur.';
    if (!form.category) return 'Kategori zorunludur.';
    if (isOAuth && !form.oauthProviderKey) return 'OAuth provider seçin.';
    if (!isOAuth && !form.key.trim()) return 'Key zorunludur.';
    if (serverUrlRequired && !form.serverUrl.trim()) return 'MCP sunucu URL’i zorunludur.';
    if (form.authType === 'api_key' && !form.apiKeyLabel.trim()) return 'API anahtarı etiketi zorunludur.';
    return null;
  };

  const handleSave = async () => {
    setNotice('');
    const problem = validate();
    if (problem) { setNotice(problem); return; }

    const mcpConfig = { serverUrl: form.serverUrl.trim() || null, transport: form.transport };
    const common = {
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon.trim() || null,
      category: form.category,
      mcpConfig,
      apiKeyLabel: form.apiKeyLabel.trim() || null,
      instructionsUrl: form.instructionsUrl.trim() || null,
      docsUrl: form.docsUrl.trim() || null,
      status: form.status,
      featured: form.featured,
      sortOrder: Number(form.sortOrder) || 0,
    };

    if (isNew) {
      const body = {
        ...common,
        authType: form.authType,
        // oauth2'de backend key'i oauthProviderKey'den türetir; yine de gönderiyoruz
        // ki api_key/none yolunda tek bir gövde şekli olsun.
        key: isOAuth ? form.oauthProviderKey : slugify(form.key),
        oauthProviderKey: isOAuth ? form.oauthProviderKey : null,
      };
      const created = await createEntry(body).unwrap().catch((err) => {
        setNotice(errText(err, 'Girdi oluşturulamadı.'));
        return null;
      });
      if (created?.id) router.push(`/cms/settings/connectors/${created.id}`);
      return;
    }

    // Güncellemede key/authType/oauthProviderKey gönderilmez — backend allowlist'i
    // zaten düşürür; göndermemek sözleşmeyi burada da açık kılar.
    const updated = await updateEntry({ id, ...common }).unwrap().catch((err) => {
      setNotice(errText(err, 'Kaydedilemedi.'));
      return null;
    });
    if (updated) setNotice('Kaydedildi.');
  };

  const busy = creating || saving;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Bağlantılar (MCP)"
        title={isNew ? 'Yeni Katalog Girdisi' : form.name || 'Katalog Girdisi'}
        description={isNew ? 'Kullanıcıların bağlanabileceği bir MCP connector tanımlayın' : form.key}
        actions={
          <Link href="/cms/settings/connectors" className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft className="size-4" /> Listeye dön
          </Link>
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errText(error, 'Girdi yüklenemedi.')}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert variant={notice === 'Kaydedildi.' ? 'info' : 'destructive'} className="mb-4">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {!isNew && isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <>
          <Card className="mb-5">
            <CardHeader><CardTitle>Kimlik</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
              <Field
                label="Kimlik doğrulama"
                hint={isNew ? 'Oluşturduktan sonra değiştirilemez.' : 'Değiştirilemez.'}
              >
                <Select
                  value={form.authType}
                  onValueChange={(v) => set({ authType: v, oauthProviderKey: '', key: '' })}
                  disabled={!isNew}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    <SelectItem value="api_key">API Anahtarı</SelectItem>
                    <SelectItem value="none">Kimliksiz</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {isOAuth ? (
                <>
                  <Field
                    label="OAuth Provider"
                    hint=".env'de CLIENT_ID/SECRET'ı olan provider'lar listelenir."
                  >
                    <Select
                      value={form.oauthProviderKey}
                      onValueChange={(v) => {
                        const p = providers.find((x) => x.key === v);
                        set({ oauthProviderKey: v, key: v, name: form.name || p?.name || '', icon: form.icon || p?.icon || '' });
                      }}
                      disabled={!isNew}
                    >
                      <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.key} value={p.key}>{p.icon} {p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Key" hint="OAuth provider anahtarından türetilir.">
                    <Input value={form.oauthProviderKey} readOnly className="font-mono" />
                  </Field>
                </>
              ) : (
                <Field label="Key" hint={isNew ? 'Benzersiz, kalıcı kimlik anahtarı.' : 'Değiştirilemez.'}>
                  <Input
                    value={form.key}
                    onChange={(e) => set({ key: e.target.value })}
                    onBlur={(e) => set({ key: slugify(e.target.value) })}
                    readOnly={!isNew}
                    placeholder="deepwiki"
                    className="font-mono"
                  />
                </Field>
              )}
            </CardContent>
          </Card>

          <Card className="mb-5">
            <CardHeader><CardTitle>Görünüm</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
              <Field label="Ad">
                <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="DeepWiki" />
              </Field>
              <Field label="İkon (emoji)">
                <Input value={form.icon} onChange={(e) => set({ icon: e.target.value })} placeholder="📚" />
              </Field>
              <Field label="Kategori">
                <Select value={form.category} onValueChange={(v) => set({ category: v })}>
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="w-full">
                <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Kullanıcıya kartta gösterilir."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-5">
            <CardHeader><CardTitle>MCP Sunucusu</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
              <Field
                label={`Sunucu URL'i${serverUrlRequired ? '' : ' (opsiyonel)'}`}
                hint={
                  isOAuth
                    ? inheritedUrl
                      ? 'Boş bırakılırsa provider’ın kod içindeki MCP sunucusu kullanılır.'
                      : 'Bu provider için kodda MCP sunucusu tanımlı değil — URL girmezseniz bağlantı tool çağıramaz.'
                    : 'Zorunlu.'
                }
              >
                <Input
                  value={form.serverUrl}
                  onChange={(e) => set({ serverUrl: e.target.value })}
                  placeholder={inheritedUrl ? `Devralınan: ${inheritedUrl}` : 'https://mcp.example.com/mcp'}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Transport">
                <Select value={form.transport} onValueChange={(v) => set({ transport: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="streamable_http">streamable_http</SelectItem>
                    <SelectItem value="sse">sse</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          {form.authType === 'api_key' && (
            <Card className="mb-5">
              <CardHeader><CardTitle>API Anahtarı</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-4 p-4">
                <Field label="Alan etiketi" hint="Kullanıcıya gösterilir.">
                  <Input value={form.apiKeyLabel} onChange={(e) => set({ apiKeyLabel: e.target.value })} placeholder="Kişisel Erişim Anahtarı" />
                </Field>
                <Field label="Yönerge linki">
                  <Input value={form.instructionsUrl} onChange={(e) => set({ instructionsUrl: e.target.value })} placeholder="https://..." />
                </Field>
              </CardContent>
            </Card>
          )}

          <Card className="mb-5">
            <CardHeader><CardTitle>Yayın</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
              <Field label="Durum" hint="Yalnız 'Yayında' girdilere bağlanılabilir.">
                <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="published">Yayında</SelectItem>
                    <SelectItem value="archived">Arşivli</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sıra">
                <Input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
              </Field>
              <Field label="Dokümantasyon linki">
                <Input value={form.docsUrl} onChange={(e) => set({ docsUrl: e.target.value })} placeholder="https://..." />
              </Field>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={form.featured} onCheckedChange={(v) => set({ featured: v })} />
                <span className="text-sm text-foreground">Öne çıkar</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={busy}>
              <Save className="size-4" /> {isNew ? 'Oluştur' : 'Kaydet'}
            </Button>
          </div>
        </>
      )}
    </RoleGuard>
  );
}
