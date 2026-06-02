'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ChevronDown, ChevronRight, Check, FileText, Users,
  Save, Globe, Plus, Loader2, Lock, Clock,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetAgreementQuery,
  useGetAcceptancesQuery,
  useSaveAgreementDraftMutation,
  usePublishAgreementMutation,
  useTranslateMutation,
} from '@/redux/services';

/* ─── Sabitler ─── */
const ALL_LOCALES = ['tr', 'en', 'de', 'ar', 'el', 'es', 'fr', 'it', 'ru'];
const LOCALE_LABELS = {
  tr: 'TR', en: 'EN', de: 'DE', ar: 'AR',
  el: 'EL', es: 'ES', fr: 'FR', it: 'IT', ru: 'RU',
};
const LOCALE_FULL = {
  tr: 'Türkçe', en: 'English', de: 'Deutsch', ar: 'العربية',
  el: 'Ελληνικά', es: 'Español', fr: 'Français', it: 'Italiano', ru: 'Русский',
};
const EMPTY_LOCALE_FORM = { title: '', summary: '', content: '' };
const SECTIONS = [
  { key: 'icerik', label: 'İçerik', icon: FileText },
  { key: 'onaylayanlar', label: 'Onaylayanlar', icon: Users },
];

function bumpVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v || '');
  if (!m) return '1.0.0';
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}
function formatTrDateTime(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

/* ─── Dil sekmeleri bileşeni ─── */
function LocaleTabs({ selectedLocale, onSelect, localeForms, translating }) {
  return (
    <div className="flex flex-wrap gap-1 pb-1 border-b border-border mb-4">
      {ALL_LOCALES.map((locale) => {
        const hasContent = !!(localeForms[locale]?.title || localeForms[locale]?.content);
        const isActive = selectedLocale === locale;
        return (
          <button
            key={locale}
            type="button"
            disabled={translating}
            onClick={() => onSelect(locale)}
            className={cn(
              'relative flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {LOCALE_LABELS[locale]}
            {hasContent && !isActive && (
              <span className="absolute -top-0.5 -right-0.5 flex size-2 rounded-full bg-green-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Ana sayfa ─── */
export default function ContractDetailPage({ params }) {
  const { slug } = use(params);
  const isNew = slug === 'new';
  const router = useRouter();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  /* API */
  const { data, isLoading, error } = useGetAgreementQuery(
    { slug, locale: 'tr' },
    { skip: isNew || !authorized },
  );
  const [saveDraft, { isLoading: saving }] = useSaveAgreementDraftMutation();
  const [publishAgreement, { isLoading: publishing }] = usePublishAgreementMutation();
  const [translate, { isLoading: translating }] = useTranslateMutation();

  /* UI state */
  const [section, setSection] = useState('icerik');
  const [selectedLocale, setSelectedLocale] = useState('tr');
  const [selectedId, setSelectedId] = useState(isNew ? 'NEW' : null);

  /* Dil başına form: { tr: {title, summary, content}, en: {...}, ... } */
  const [localeForms, setLocaleForms] = useState(
    Object.fromEntries(ALL_LOCALES.map((l) => [l, { ...EMPTY_LOCALE_FORM }])),
  );
  /* Versiyon ve slug tüm diller için ortaktır */
  const [sharedFields, setSharedFields] = useState({ slug: '', version: '1.0.0' });
  const [notifyPrevious, setNotifyPrevious] = useState(false);
  const [notice, setNotice] = useState('');

  const versions = data?.versions ?? [];
  const selected = versions.find((v) => v.id === selectedId) || null;
  const isDraftMode = isNew || selectedId === 'NEW' || selected?.status === 'draft';
  const isPublicSelected = !isNew && selected?.status === 'public';

  /* İlk yüklemede en son versiyonu seç */
  useEffect(() => {
    if (isNew || !versions.length || selectedId !== null) return;
    setSelectedId(versions[0].id);
  }, [versions, isNew, selectedId]);

  /* Seçili TR versiyonunu TR form state'e yükle */
  useEffect(() => {
    if (isNew || selectedId === 'NEW' || !selectedId) return;
    const v = versions.find((x) => x.id === selectedId);
    if (!v) return;
    setSharedFields({ slug, version: v.version });
    setLocaleForms((prev) => ({
      ...prev,
      tr: { title: v.title ?? '', summary: v.summary ?? '', content: v.content ?? '' },
    }));
  }, [selectedId, versions, isNew, slug]);

  /* Yeni versiyon: mevcut TR içeriğini şablonla */
  function startNewVersion() {
    const base = selected || versions[0];
    setNotice('');
    setSelectedId('NEW');
    setSharedFields((s) => ({ ...s, version: bumpVersion(base?.version) }));
    setLocaleForms((prev) => ({
      ...prev,
      tr: {
        title: base?.title || data?.title || '',
        summary: base?.summary || '',
        content: base?.content || '',
      },
    }));
  }

  const setLocaleField = useCallback((k, v) => {
    setLocaleForms((prev) => ({
      ...prev,
      [selectedLocale]: { ...(prev[selectedLocale] ?? EMPTY_LOCALE_FORM), [k]: v },
    }));
  }, [selectedLocale]);

  /* Tüm dillere otomatik çeviri */
  async function handleTranslate() {
    const src = localeForms.tr;
    if (!src.title && !src.summary && !src.content) {
      setNotice('Çeviri için önce Türkçe içeriği doldurun.');
      return;
    }
    setNotice('');
    try {
      const [titleRes, summaryRes, contentRes] = await Promise.all([
        src.title
          ? translate({ text: src.title, context: 'legal agreement title' }).unwrap()
          : Promise.resolve({ translations: {} }),
        src.summary
          ? translate({ text: src.summary, context: 'legal agreement summary' }).unwrap()
          : Promise.resolve({ translations: {} }),
        src.content
          ? translate({ text: src.content, context: 'legal agreement content, preserve HTML/Markdown formatting' }).unwrap()
          : Promise.resolve({ translations: {} }),
      ]);
      setLocaleForms((prev) => {
        const next = { ...prev };
        for (const l of ALL_LOCALES.filter((x) => x !== 'tr')) {
          next[l] = {
            title: titleRes.translations?.[l] ?? prev[l]?.title ?? '',
            summary: summaryRes.translations?.[l] ?? prev[l]?.summary ?? '',
            content: contentRes.translations?.[l] ?? prev[l]?.content ?? '',
          };
        }
        return next;
      });
      setNotice('Çeviri tamamlandı. Dil sekmelerini inceleyebilirsiniz.');
    } catch {
      setNotice('Çeviri sırasında hata oluştu.');
    }
  }

  /* Taslak kaydetme — seçili dil için */
  async function persistDraft(locale) {
    const lf = localeForms[locale] ?? EMPTY_LOCALE_FORM;
    const finalSlug = (isNew ? sharedFields.slug : slug).trim().toLowerCase();
    if (!finalSlug || !lf.title?.trim() || !lf.content?.trim() || !lf.summary?.trim()) {
      setNotice(`Slug, başlık, özet ve içerik zorunludur. (${LOCALE_FULL[locale]})`);
      return null;
    }
    const r = await saveDraft({
      slug: finalSlug,
      title: lf.title,
      version: sharedFields.version,
      locale,
      content: lf.content,
      summary: lf.summary,
    }).unwrap().catch((e) => {
      setNotice(e?.data?.message || 'Kaydedilemedi.');
      return null;
    });
    return r ? { r, finalSlug } : null;
  }

  /* Seçili dili kaydet */
  async function handleSave() {
    setNotice('');
    const out = await persistDraft(selectedLocale);
    if (!out) return;
    if (isNew) { router.push(`/cms/contracts/${out.finalSlug}`); return; }
    const id = out.r?.agreement?._id ?? out.r?.agreement?.id;
    if (id) setSelectedId(id);
    setNotice(`Taslak kaydedildi. (${LOCALE_FULL[selectedLocale]})`);
  }

  /* Tüm dolu dilleri toplu kaydet */
  async function handleSaveAll() {
    setNotice('');
    const filledLocales = ALL_LOCALES.filter((l) => {
      const lf = localeForms[l];
      return lf?.title?.trim() && lf?.content?.trim() && lf?.summary?.trim();
    });
    if (!filledLocales.length) { setNotice('Kaydetmek için en az bir dilde içerik doldurulmalı.'); return; }
    let savedSlug = isNew ? sharedFields.slug.trim().toLowerCase() : slug;
    for (const l of filledLocales) {
      const out = await persistDraft(l);
      if (!out) return;
      if (isNew && l === filledLocales[0]) {
        savedSlug = out.finalSlug;
        router.push(`/cms/contracts/${savedSlug}`);
        return;
      }
      const id = out.r?.agreement?._id ?? out.r?.agreement?.id;
      if (id) setSelectedId(id);
    }
    setNotice(`${filledLocales.length} dil kaydedildi: ${filledLocales.map((l) => LOCALE_LABELS[l]).join(', ')}`);
  }

  async function handlePublish() {
    setNotice('');
    let id = selectedId && selectedId !== 'NEW' ? selectedId : null;
    if (!id) {
      const out = await persistDraft(selectedLocale);
      if (!out) return;
      id = out.r?.agreement?._id ?? out.r?.agreement?.id;
      if (isNew) { router.push(`/cms/contracts/${out.finalSlug}`); return; }
    }
    if (!id) return;
    const res = await publishAgreement({ id, slug, notifyPrevious }).unwrap().catch((e) => {
      setNotice(e?.data?.message || 'Yayınlanamadı.');
      return null;
    });
    if (res) {
      setSelectedId(id);
      setNotice(`Yayınlandı.${notifyPrevious ? ` ${res.notified || 0} önceki onaylayıcıya e-posta gönderildi.` : ''}`);
    }
  }

  /* Loading / error states */
  if (!isNew && isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
        <PageHeader breadcrumb={[{ label: 'Sözleşmeler', href: '/cms/contracts' }, { label: '…' }]} title="Yükleniyor…" />
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </RoleGuard>
    );
  }
  if (!isNew && (error || !data)) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
        <PageHeader breadcrumb={[{ label: 'Sözleşmeler', href: '/cms/contracts' }, { label: 'Bulunamadı' }]} title="Sözleşme Bulunamadı" />
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {error ? (error?.data?.message || 'Yükleme hatası.') : 'Bu sözleşme bulunamadı.'}{' '}
            <Link href="/cms/contracts" className="text-primary hover:underline">Listeye dön</Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  const title = isNew ? 'Yeni Sözleşme' : data?.title || slug;
  const currentForm = localeForms[selectedLocale] ?? EMPTY_LOCALE_FORM;
  const filledLocaleCount = ALL_LOCALES.filter((l) => !!(localeForms[l]?.title || localeForms[l]?.content)).length;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader breadcrumb={[{ label: 'Sözleşmeler', href: '/cms/contracts' }, { label: title }]} title={title} />

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* Sol alt-menü */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
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
          {section === 'icerik' ? (
            <>
              {notice && (
                <Alert variant="info"><AlertDescription>{notice}</AlertDescription></Alert>
              )}

              {/* Versiyonlar */}
              {!isNew && (
                <Card>
                  <CardHeader>
                    <CardTitle>Versiyonlar</CardTitle>
                    <CardToolbar>
                      <Button size="sm" variant="outline" onClick={startNewVersion}>
                        <Plus className="size-4" /> Yeni Versiyon
                      </Button>
                    </CardToolbar>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-1.5 p-4">
                    {selectedId === 'NEW' && (
                      <span className="rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        Yeni (v{sharedFields.version})
                      </span>
                    )}
                    {versions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => { setSelectedId(v.id); setNotice(''); }}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          selectedId === v.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                        )}
                      >
                        v{v.version}
                        {v.status === 'draft' ? <Badge variant="muted">Taslak</Badge> : <Badge variant="success">Yayında</Badge>}
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Editör */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isDraftMode ? 'İçerik Düzenle' : 'İçerik (Yayında)'}
                    <span className="text-xs font-normal text-muted-foreground">
                      {filledLocaleCount}/{ALL_LOCALES.length} dil dolu
                    </span>
                  </CardTitle>
                  {isPublicSelected && (
                    <CardToolbar><Badge variant="success">v{selected?.version} yayında</Badge></CardToolbar>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  {isPublicSelected && (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <Lock className="size-3.5" /> Yayınlanmış versiyon düzenlenemez. Değişiklik için "Yeni Versiyon" oluşturun.
                    </div>
                  )}

                  {/* Slug + Versiyon (ortak alanlar) */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {isNew && (
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Slug</label>
                        <Input
                          value={sharedFields.slug}
                          onChange={(e) => setSharedFields((s) => ({ ...s, slug: e.target.value }))}
                          placeholder="kullanici-sozlesmesi"
                          className="font-mono text-xs"
                        />
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Versiyon</label>
                      <Input
                        value={sharedFields.version}
                        onChange={(e) => setSharedFields((s) => ({ ...s, version: e.target.value }))}
                        readOnly={isPublicSelected}
                        placeholder="1.0.0"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Dil Sekmeleri */}
                  <LocaleTabs
                    selectedLocale={selectedLocale}
                    onSelect={setSelectedLocale}
                    localeForms={localeForms}
                    translating={translating}
                  />

                  {/* Seçili dil alanları */}
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {LOCALE_FULL[selectedLocale]}
                      {selectedLocale !== 'tr' && !currentForm.title && !currentForm.content && (
                        <span className="ml-2 text-amber-500">· Henüz içerik yok — "Otomatik Çevir" ile doldurun</span>
                      )}
                    </p>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Başlık</label>
                      <Input
                        value={currentForm.title}
                        onChange={(e) => setLocaleField('title', e.target.value)}
                        readOnly={isPublicSelected}
                        placeholder="Sözleşme başlığı"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Özet</label>
                      <Input
                        value={currentForm.summary}
                        onChange={(e) => setLocaleField('summary', e.target.value)}
                        readOnly={isPublicSelected}
                        placeholder="Kısa özet (maks. 500)"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">İçerik</label>
                      <textarea
                        value={currentForm.content}
                        onChange={(e) => setLocaleField('content', e.target.value)}
                        readOnly={isPublicSelected}
                        rows={16}
                        placeholder="Sözleşme metni (HTML/Markdown destekli)…"
                        className={cn(
                          'w-full rounded-lg border border-input bg-background p-3 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30 resize-none',
                          isPublicSelected && 'opacity-70',
                        )}
                      />
                    </div>
                  </div>

                  {/* Aksiyonlar */}
                  {isPublicSelected ? (
                    <Button onClick={startNewVersion}>
                      <Plus className="size-4" /> Yeni Versiyon Oluştur
                    </Button>
                  ) : (
                    <div className="space-y-3 border-t border-border pt-4">
                      {/* Çeviri butonu */}
                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleTranslate}
                          disabled={translating || saving || publishing || !localeForms.tr?.title}
                          className="gap-1.5"
                        >
                          {translating ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-3.5" />}
                          {translating ? 'Çevriliyor…' : 'Türkçe\'den Otomatik Çevir'}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Türkçe içerik baz alınır, 8 dil doldurulur
                        </span>
                      </div>

                      {/* Kaydet / yayınla */}
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={notifyPrevious}
                          onChange={(e) => setNotifyPrevious(e.target.checked)}
                          className="size-4 rounded border-input"
                        />
                        Yayınlarken önceki onaylayanlara e-posta gönder
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || publishing || translating}>
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                          {LOCALE_LABELS[selectedLocale]} Kaydet
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleSaveAll} disabled={saving || publishing || translating}>
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Tümünü Kaydet ({filledLocaleCount})
                        </Button>
                        <Button size="sm" onClick={handlePublish} disabled={saving || publishing || translating}>
                          {publishing ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
                          Yayınla
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <AcceptancesSection slug={slug} isNew={isNew} authorized={authorized} />
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

/* ─── Onaylayanlar ─── */
function AcceptancesSection({ slug, isNew, authorized }) {
  const { data, isLoading, error } = useGetAcceptancesQuery({ slug }, { skip: isNew || !authorized });
  const versions = data?.versions ?? [];

  if (isNew) {
    return <SimpleEmptyCard title="Onaylayanlar" message="Sözleşme kaydedildikten sonra onaylayanlar burada görünür." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onaylayanlar</CardTitle>
        <CardToolbar><Badge variant="muted">{data?.total ?? 0} kabul</Badge></CardToolbar>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Yüklenemedi</AlertTitle>
            <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : versions.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="Onaylayan yok" description="Bu sözleşmeyi henüz kimse onaylamamış." className="py-10" />
        ) : (
          versions.map((vg) => (
            <div key={vg.version} className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium text-foreground">Versiyon v{vg.version}</span>
                <Badge variant="muted">{vg.count} onay</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>Onay Tarihi</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Bağlam</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vg.acceptors.map((a) => (
                      <TableRow key={`${vg.version}-${a.userId}-${a.acceptedAt}`}>
                        <TableCell className="text-sm">{a.name}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="size-3" />{formatTrDateTime(a.acceptedAt)}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{a.ip}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.context}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SimpleEmptyCard({ title, message }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="p-2">
        <EmptyState icon={<Users className="size-5" />} title="Veri yok" description={message} className="py-10" />
      </CardContent>
    </Card>
  );
}
