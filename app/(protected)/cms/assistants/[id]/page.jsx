'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Info,
  SlidersHorizontal,
  Users,
  Target,
  Boxes,
  Wrench,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/page-shell';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetAssistantQuery,
  useGetAssistantToolDefinitionsQuery,
} from '@/redux/services';

const SECTIONS = [
  { key: 'genel', label: 'Genel', icon: Info },
  { key: 'yapilandirma', label: 'Yapılandırma', icon: SlidersHorizontal },
  { key: 'personalar', label: 'Personalar', icon: Users },
  { key: 'intentler', label: 'Intent & Akış', icon: Target },
  { key: 'kapsam', label: 'Kapsam & Kaynaklar', icon: Boxes },
  { key: 'tools', label: 'Tool Tanımları', icon: Wrench },
];

const statusMeta = {
  draft: { label: 'Taslak', variant: 'muted' },
  published: { label: 'Yayında', variant: 'success' },
  active: { label: 'Aktif', variant: 'success' },
  disabled: { label: 'Devre Dışı', variant: 'warning' },
  archived: { label: 'Arşivli', variant: 'muted' },
};

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CmsAssistantDetailPage({ params }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ACCESS]);

  const [section, setSection] = useState('genel');
  const { data: a, isLoading, error } = useGetAssistantQuery(id, { skip: !authorized });

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
        <PageHeader breadcrumb={[{ label: 'Asistanlar', href: '/cms/assistants' }, { label: '…' }]} title="Yükleniyor…" />
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </RoleGuard>
    );
  }

  if (error || !a) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
        <PageHeader
          breadcrumb={[{ label: 'Asistanlar', href: '/cms/assistants' }, { label: 'Bulunamadı' }]}
          title="Asistan Bulunamadı"
        />
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {error
              ? error?.data?.message || error?.normalizedMessage || 'Asistan yüklenirken hata oluştu.'
              : 'Bu ID ile eşleşen asistan bulunamadı.'}{' '}
            <Link href="/cms/assistants" className="text-primary hover:underline">
              Listeye dön
            </Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  const name = a.asistan_name || a.title || 'İsimsiz Asistan';

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
      <PageHeader breadcrumb={[{ label: 'Asistanlar', href: '/cms/assistants' }, { label: name }]} title={name} />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Sol alt-menü */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar name={name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                <Badge variant={statusMeta[a.status]?.variant ?? 'muted'}>
                  {statusMeta[a.status]?.label ?? a.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="mt-3">
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {s.label}
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        {/* Sağ içerik */}
        <div className="space-y-5">
          {section === 'genel' && <GeneralSection a={a} />}
          {section === 'yapilandirma' && <ConfigSection a={a} />}
          {section === 'personalar' && <PersonasSection a={a} />}
          {section === 'intentler' && <IntentsSection a={a} />}
          {section === 'kapsam' && <ScopeSection a={a} />}
          {section === 'tools' && <ToolsSection id={id} authorized={authorized} />}
        </div>
      </div>
    </RoleGuard>
  );
}

/* ─── sections ─── */
function GeneralSection({ a }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Genel Bilgiler</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <Field label="Ad" value={a.asistan_name} />
          <Field label="Başlık" value={a.title || '—'} />
          <Field label="Alt Başlık" value={a.subtitle || '—'} />
          <Field label="Slug" value={a.slug || '—'} mono />
          <Field label="Durum" value={statusMeta[a.status]?.label ?? a.status} />
          <Field label="Aktif" value={a.active ? 'Evet' : 'Hayır'} />
          <Field label="Dil" value={a.locale?.toUpperCase() || '—'} />
          <Field label="Assistant ID" value={a.assistantId || '—'} mono />
          <Field label="Sahip (userId)" value={a.userId || '—'} mono />
          <Field label="Firma (companyId)" value={a.companyId || '—'} mono />
          <Field label="Yayın Tarihi" value={formatTrDate(a.publishedAt)} />
          <Field label="Oluşturulma" value={formatTrDate(a.createdAt)} />
        </CardContent>
      </Card>

      {a.description && (
        <Card>
          <CardHeader>
            <CardTitle>Açıklama</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="whitespace-pre-wrap text-sm text-foreground">{a.description}</p>
          </CardContent>
        </Card>
      )}

      {(a.tags?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Etiketler</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Chips items={a.tags} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ConfigSection({ a }) {
  const p = a.preferences || {};
  const cs = a.conversationStrategy || {};
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Yapılandırma</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <Field label="Mesaj Limiti" value={a.messageLimit ?? '—'} />
          <Field label="Şifreleme" value={a.encryptionEnabled ? 'Açık' : 'Kapalı'} />
          <Field label="Ton" value={p.tone || '—'} />
          <Field label="Yanıt Uzunluğu" value={p.responseLength || '—'} />
          <Field label="Öneriler" value={p.allowSuggestions ? 'Açık' : 'Kapalı'} />
          <Field label="Hedef Kitle" value={cs.audience || '—'} />
          <Field label="Guest Mesaj Limiti" value={cs.guestMessageLimit ?? '—'} />
        </CardContent>
      </Card>

      <FieldListCard title="Etkin Tool'lar" items={a.enabledTools} />
      <FieldListCard title="İzin Verilen Dosya Tipleri" items={a.allowedFileTypes} />
      {(a.disabledCapabilities?.length ?? 0) > 0 && (
        <FieldListCard title="Devre Dışı Yetenekler" items={a.disabledCapabilities} />
      )}

      {a.systemPrompt && (
        <Card>
          <CardHeader>
            <CardTitle>Sistem Prompt'u</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-xs text-foreground">
              {a.systemPrompt}
            </pre>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function PersonasSection({ a }) {
  const personas = a.personas || [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalar</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{personas.length} persona</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-2">
        {personas.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="Persona yok" description="Tanımlı persona bulunmuyor." className="py-10" />
        ) : (
          <div className="space-y-2 p-2">
            {personas.map((per) => (
              <div key={per.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{per.label}</p>
                  {(per.isDefault || a.defaultPersonaId === per.id) && <Badge variant="primary">Varsayılan</Badge>}
                </div>
                {per.description && <p className="mt-1 text-sm text-muted-foreground">{per.description}</p>}
                {per.prompt && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    {per.prompt}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntentsSection({ a }) {
  const s = a.intentSettings || {};
  const defs = a.intentDefinitions || [];
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Intent Ayarları</CardTitle>
          <CardToolbar>
            <Badge variant={s.enabled ? 'success' : 'muted'}>{s.enabled ? 'Açık' : 'Kapalı'}</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <Field label="Mod" value={s.mode || '—'} />
          <Field label="Min. Güven" value={s.minConfidence ?? '—'} />
          <Field label="Async" value={s.runAsync ? 'Evet' : 'Hayır'} />
          <Field label="Maks. Eşleşme" value={s.maxMatchesPerMessage ?? '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intent Tanımları</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{defs.length} tanım</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-2">
          {defs.length === 0 ? (
            <EmptyState icon={<Target className="size-5" />} title="Intent tanımı yok" description="Tanımlı intent bulunmuyor." className="py-10" />
          ) : (
            <div className="space-y-2 p-2">
              {defs.map((d) => (
                <div key={d.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{d.label || d.description?.slice(0, 40) || 'Intent'}</p>
                    {d.active ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Pasif</Badge>}
                    <Badge variant="muted">öncelik: {d.priority ?? 0}</Badge>
                  </div>
                  {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">workflowRefId: {d.workflowRefId}</p>
                  {(d.keywords?.length ?? 0) > 0 && (
                    <div className="mt-2">
                      <Chips items={d.keywords} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ScopeSection({ a }) {
  const renderScope = (label, scope) => {
    if (!scope) return null;
    return (
      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>Mod: <span className="text-foreground">{scope.mode || '—'}</span></span>
          <span>Maks. Öğe: <span className="text-foreground">{scope.maxItems ?? '—'}</span></span>
          <span>Ürün: <span className="text-foreground">{scope.productIds?.length ?? 0}</span></span>
          <span>Kategori: <span className="text-foreground">{scope.categoryIds?.length ?? 0}</span></span>
        </div>
      </div>
    );
  };
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Kapsamlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {renderScope('Ürün Kapsamı', a.productScope)}
          {renderScope('Hizmet Kapsamı', a.serviceScope)}
          {renderScope('Randevu Kapsamı', a.bookingScope)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bilgi Kaynakları</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          <Field label="Kütüphaneler" value={`${a.libraryIds?.length ?? 0} adet`} />
          <Field label="Dosyalar" value={`${a.fileIds?.length ?? 0} adet`} />
          <Field label="Web Siteleri" value={`${a.websiteIds?.length ?? 0} adet`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kaynak Bağlamaları</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{a.resourceBindings?.length ?? 0} bağlama</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-2">
          {(a.resourceBindings?.length ?? 0) === 0 ? (
            <EmptyState icon={<Boxes className="size-5" />} title="Bağlama yok" description="Tanımlı kaynak bağlaması bulunmuyor." className="py-10" />
          ) : (
            <div className="space-y-0.5">
              {a.resourceBindings.map((b, i) => (
                <div key={`${b.type}-${b.id}-${i}`} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{b.type}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{b.id}</span>
                  </div>
                  <Chips items={b.permissions} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ToolsSection({ id, authorized }) {
  const { data, isLoading, error } = useGetAssistantToolDefinitionsQuery(id, { skip: !authorized });
  const tools = data?.toolDefinitions ?? [];
  const enabled = data?.enabledTools ?? [];

  return (
    <>
      <FieldListCard title="Etkin Tool'lar" items={enabled} />
      <Card>
        <CardHeader>
          <CardTitle>Tool Tanımları</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{tools.length} özel tanım</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-2">
          {error ? (
            <div className="p-2">
              <Alert variant="destructive">
                <AlertTitle>Tool tanımları yüklenemedi</AlertTitle>
                <AlertDescription>
                  {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : tools.length === 0 ? (
            <EmptyState icon={<Wrench className="size-5" />} title="Özel tool tanımı yok" description="Bu asistan için özelleştirilmiş tool tanımı bulunmuyor." className="py-10" />
          ) : (
            <div className="space-y-2 p-2">
              {tools.map((t) => (
                <div key={t.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{t.toolName || t.parent || t.key}</p>
                    {t.active ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Pasif</Badge>}
                  </div>
                  {t.userLabel && <p className="mt-1 text-sm text-muted-foreground">{t.userLabel}</p>}
                  {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
                  {(t.keywords?.length ?? 0) > 0 && (
                    <div className="mt-2">
                      <Chips items={t.keywords} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ─── helpers ─── */
function Field({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('truncate text-sm font-medium text-foreground', mono && 'font-mono text-xs')} title={String(value ?? '')}>
        {value ?? '—'}
      </p>
    </div>
  );
}

function Chips({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it, i) => (
        <Badge key={`${it}-${i}`} variant="muted">{String(it)}</Badge>
      ))}
    </div>
  );
}

function FieldListCard({ title, items }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{items?.length ?? 0}</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-6">
        <Chips items={items} />
      </CardContent>
    </Card>
  );
}
