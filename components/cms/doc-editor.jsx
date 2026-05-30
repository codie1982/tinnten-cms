'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Save, Languages, Bold, Italic, Heading2, List, Link2, Code, Loader2, ChevronLeft, Check,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useGetDocsMetaQuery,
  useGetDocCategoriesQuery,
  useGetDocQuery,
  useSaveDocMutation,
  useTranslateDocMutation,
} from '@/redux/services';

const FALLBACK_LOCALES = [
  { code: 'tr', name: 'Türkçe' }, { code: 'en', name: 'İngilizce' }, { code: 'de', name: 'Almanca' },
  { code: 'fr', name: 'Fransızca' }, { code: 'es', name: 'İspanyolca' }, { code: 'it', name: 'İtalyanca' },
  { code: 'el', name: 'Yunanca' }, { code: 'ru', name: 'Rusça' }, { code: 'ar', name: 'Arapça' },
];

const slugify = (s) =>
  (s || '').toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const EMPTY = { title: '', description: '', contentMarkdown: '', category: '', published: false };

export function DocEditor({ slug: slugProp = null }) {
  const router = useRouter();
  const isNew = !slugProp;

  const { data: meta } = useGetDocsMetaQuery();
  const locales = meta?.locales ?? FALLBACK_LOCALES;
  const { data: categories = [] } = useGetDocCategoriesQuery();

  const [activeLocale, setActiveLocale] = useState('tr');
  const [slug, setSlug] = useState('');
  const [form, setForm] = useState(EMPTY);
  const taRef = useRef(null);

  const { data: docData, isFetching, error } = useGetDocQuery(
    { slug: slugProp, locale: activeLocale },
    { skip: isNew },
  );
  const [saveDoc, { isLoading: saving }] = useSaveDocMutation();
  const [translateDoc, { isLoading: translating }] = useTranslateDocMutation();
  const [translateResult, setTranslateResult] = useState(null);

  // Editing: load fetched doc into form when locale/data changes
  useEffect(() => {
    if (isNew) return;
    const d = docData?.doc;
    if (d) {
      setForm({
        title: d.title || '',
        description: d.description || '',
        contentMarkdown: d.contentMarkdown || '',
        category: d.category?._id || d.category || '',
        published: Boolean(d.published),
      });
    } else if (docData) {
      // bu dilde henüz içerik yok → boş form (yeni dil oluşturma)
      setForm((f) => ({ ...EMPTY, category: f.category }));
    }
  }, [docData, isNew, activeLocale]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const effectiveSlug = isNew ? slug : slugProp;
  const availableLocales = docData?.locales ?? [];

  const insertAround = (before, after = '') => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e);
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    setField('contentMarkdown', next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + before.length;
      ta.selectionEnd = e + before.length + sel.length;
    });
  };
  const insertLinePrefix = (prefix) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setField('contentMarkdown', next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + prefix.length; });
  };

  const handleSave = async () => {
    const finalSlug = effectiveSlug || slugify(form.title);
    if (!finalSlug || !form.title.trim()) return;
    const saved = await saveDoc({
      slug: finalSlug,
      locale: activeLocale,
      title: form.title,
      description: form.description,
      contentMarkdown: form.contentMarkdown,
      category: form.category || null,
      published: form.published,
    }).unwrap().catch(() => null);
    if (saved && isNew) router.push(`/cms/documents/${finalSlug}`);
  };

  const handleTranslate = async () => {
    if (isNew || !slugProp) return;
    setTranslateResult(null);
    const res = await translateDoc({ slug: slugProp, sourceLocale: activeLocale }).unwrap().catch(() => null);
    if (res) setTranslateResult(res);
  };

  const localeHasContent = (code) => availableLocales.some((l) => l.locale === code);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Dökümanlar', href: '/cms/documents' }, { label: isNew ? 'Yeni' : effectiveSlug }]}
        title={isNew ? 'Yeni Döküman' : form.title || effectiveSlug}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="outline" onClick={handleTranslate} disabled={translating || saving}>
                {translating ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
                9 Dile Otomatik Çevir
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving || !form.title.trim() || (isNew && !slug && !form.title)}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Kaydet
            </Button>
          </div>
        }
      />

      {translateResult && (
        <Alert variant="info" className="mb-4">
          <AlertTitle>Çeviri tamamlandı</AlertTitle>
          <AlertDescription>
            {translateResult.translated?.length || 0} dile çevrildi
            {translateResult.failed?.length ? `, ${translateResult.failed.length} dil başarısız (${translateResult.failed.join(', ')})` : ''}.
            Çevrilen diller taslak olarak kaydedildi.
          </AlertDescription>
        </Alert>
      )}

      {/* Dil sekmeleri */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
        {locales.map((l) => {
          const active = activeLocale === l.code;
          const has = isNew ? l.code === 'tr' : localeHasContent(l.code);
          return (
            <button
              key={l.code}
              type="button"
              disabled={isNew && l.code !== 'tr'}
              onClick={() => setActiveLocale(l.code)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title={l.name}
            >
              <span className="uppercase">{l.code}</span>
              {has && <Check className={cn('size-3', active ? 'text-primary-foreground' : 'text-green-600')} />}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* İçerik */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>İçerik ({activeLocale.toUpperCase()})</CardTitle>
              {!isNew && isFetching && (
                <CardToolbar><Loader2 className="size-4 animate-spin text-muted-foreground" /></CardToolbar>
              )}
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {error && !isNew ? (
                <Alert variant="destructive">
                  <AlertTitle>Yüklenemedi</AlertTitle>
                  <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
                </Alert>
              ) : null}

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Başlık</label>
                <Input
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="Doküman başlığı"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
                <Input
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Kısa açıklama (meta)"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">İçerik (Markdown)</label>
                  <div className="flex items-center gap-0.5">
                    <ToolbarBtn onClick={() => insertAround('**', '**')} icon={Bold} title="Kalın" />
                    <ToolbarBtn onClick={() => insertAround('_', '_')} icon={Italic} title="İtalik" />
                    <ToolbarBtn onClick={() => insertLinePrefix('## ')} icon={Heading2} title="Başlık" />
                    <ToolbarBtn onClick={() => insertLinePrefix('- ')} icon={List} title="Liste" />
                    <ToolbarBtn onClick={() => insertAround('[', '](https://)')} icon={Link2} title="Bağlantı" />
                    <ToolbarBtn onClick={() => insertAround('`', '`')} icon={Code} title="Kod" />
                  </div>
                </div>
                <textarea
                  ref={taRef}
                  value={form.contentMarkdown}
                  onChange={(e) => setField('contentMarkdown', e.target.value)}
                  placeholder="# Başlık&#10;&#10;Markdown içeriğinizi buraya yazın..."
                  className="min-h-[420px] w-full rounded-lg border border-input bg-background p-3 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Yan ayarlar */}
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Ayarlar</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Slug</label>
                <Input
                  value={effectiveSlug}
                  onChange={(e) => isNew && setSlug(slugify(e.target.value))}
                  readOnly={!isNew}
                  placeholder="ai-asistan-olusturma"
                  className={cn('font-mono text-xs', !isNew && 'opacity-70')}
                />
                {isNew && !slug && form.title && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Boş bırakılırsa başlıktan üretilir: {slugify(form.title)}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Kategori</label>
                <Select value={form.category || 'none'} onValueChange={(v) => setField('category', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Kategori seç" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kategorisiz</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <span className="text-sm text-foreground">Yayında</span>
                <button
                  type="button"
                  onClick={() => setField('published', !form.published)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    form.published ? 'bg-primary' : 'bg-muted',
                  )}
                >
                  <span className={cn('absolute top-0.5 size-5 rounded-full bg-white transition-transform', form.published ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
              </div>

              {!isNew && (
                <p className="text-xs text-muted-foreground">
                  Bu doküman {availableLocales.length} dilde mevcut. Otomatik çeviri kaynak olarak <b>{activeLocale.toUpperCase()}</b> dilini kullanır.
                </p>
              )}
            </CardContent>
          </Card>

          <Link href="/cms/documents" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
            <ChevronLeft className="size-4" />
            Listeye Dön
          </Link>
        </div>
      </div>
    </>
  );
}

function ToolbarBtn({ onClick, icon: Icon, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Icon className="size-3.5" />
    </button>
  );
}
