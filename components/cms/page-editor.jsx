'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, Globe2, Languages, Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { CONTENT_LOCALES } from '@/config/api';
import { cn } from '@/lib/utils';
import {
  useCreateDocPageMutation, useGetDocCategoriesQuery, useGetDocPageQuery,
  usePublishDocPageLocaleMutation, useSaveDocPageLocaleMutation,
  useTranslateDocMutation, useUnpublishDocPageLocaleMutation,
} from '@/redux/services';
import { PageWysiwygEditor } from './page-wysiwyg-editor';

const slugify = (value) => String(value || '').toLocaleLowerCase('tr-TR')
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
  .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

const EMPTY = {
  title: '', description: '', routePath: '/document', slug: '', contentHtml: '', category: '',
  seo: { title: '', description: '', canonicalUrl: '', index: true, follow: true, ogTitle: '', ogDescription: '', ogImage: '', schemaType: 'WebPage' },
};

const errorText = (error) => error?.data?.message || error?.normalizedMessage || error?.message || 'İşlem tamamlanamadı.';

export function PageEditor({ pageId: initialPageId = null }) {
  const router = useRouter();
  const isNew = !initialPageId;
  const [pageId, setPageId] = useState(initialPageId);
  const [locale, setLocale] = useState('tr');
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('draft');
  const [tab, setTab] = useState('content');
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState(null);
  const { data: categories = [] } = useGetDocCategoriesQuery();
  const { data, isFetching } = useGetDocPageQuery({ pageId, locale }, { skip: !pageId });
  const [createPage, { isLoading: creating }] = useCreateDocPageMutation();
  const [saveLocale, { isLoading: saving }] = useSaveDocPageLocaleMutation();
  const [publishLocale, { isLoading: publishing }] = usePublishDocPageLocaleMutation();
  const [unpublishLocale, { isLoading: unpublishing }] = useUnpublishDocPageLocaleMutation();
  const [translateDoc, { isLoading: translating }] = useTranslateDocMutation();
  const busy = creating || saving || publishing || unpublishing;
  const locales = data?.locales ?? [];

  useEffect(() => {
    if (!pageId || isFetching) return;
    const doc = data?.doc;
    if (doc) {
      setForm({
        title: doc.title || '', description: doc.description || '', routePath: doc.routePath || '/document',
        slug: doc.slug || '', contentHtml: doc.contentHtml || '', category: doc.category?._id || doc.category || '',
        seo: { ...EMPTY.seo, ...(doc.seo || {}) },
      });
      setStatus(doc.status || (doc.published ? 'published' : 'draft'));
    } else {
      setForm((current) => ({ ...EMPTY, category: current.category }));
      setStatus('draft');
    }
    setDirty(false);
  }, [data, isFetching, locale, pageId]);

  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setDirty(true); };
  const updateSeo = (key, value) => { setForm((current) => ({ ...current, seo: { ...current.seo, [key]: value } })); setDirty(true); };
  const normalizedRoute = `/${form.routePath.split('/').filter(Boolean).join('/')}`.replace(/\/$/, '') || '';
  const effectiveSlug = slugify(form.slug || form.title);
  const fullPath = `${normalizedRoute}/${effectiveSlug}`.replace(/\/{2,}/g, '/');
  const publicUrl = `https://tinten.ai/${locale}${fullPath}`;
  const seoTitle = form.seo.title || form.title || 'Sayfa başlığı';
  const seoDescription = form.seo.description || form.description || 'Sayfa açıklaması';
  const payload = useMemo(() => ({ ...form, slug: effectiveSlug, routePath: normalizedRoute || '' }), [form, effectiveSlug, normalizedRoute]);

  async function save() {
    setNotice(null);
    if (!form.title.trim() || !effectiveSlug) { setNotice({ type: 'error', text: 'Başlık ve geçerli bir slug zorunludur.' }); return null; }
    try {
      if (!pageId) {
        const result = await createPage({ ...payload, locale }).unwrap();
        const nextId = String(result.pageId);
        setPageId(nextId); setDirty(false);
        router.replace(`/cms/documents/${nextId}`);
        setNotice({ type: 'success', text: 'Sayfa taslağı oluşturuldu.' });
        return nextId;
      }
      await saveLocale({ pageId, locale, ...payload }).unwrap();
      setDirty(false); setNotice({ type: 'success', text: 'Değişiklikler kaydedildi.' });
      return pageId;
    } catch (error) { setNotice({ type: 'error', text: errorText(error) }); return null; }
  }

  async function togglePublish() {
    const id = dirty || !pageId ? await save() : pageId;
    if (!id) return;
    try {
      if (status === 'published') { await unpublishLocale({ pageId: id, locale }).unwrap(); setStatus('draft'); setNotice({ type: 'success', text: 'Sayfa taslağa alındı.' }); }
      else { await publishLocale({ pageId: id, locale }).unwrap(); setStatus('published'); setNotice({ type: 'success', text: 'Sayfa yayınlandı.' }); }
    } catch (error) { setNotice({ type: 'error', text: errorText(error) }); }
  }

  async function translate() {
    if (!pageId || !effectiveSlug) return;
    setNotice(null);
    try {
      const result = await translateDoc({ slug: effectiveSlug, sourceLocale: locale }).unwrap();
      setNotice({ type: 'success', text: `${result.translated?.length || 0} dil taslak olarak oluşturuldu${result.failed?.length ? `; ${result.failed.length} dil başarısız` : ''}.` });
    } catch (error) { setNotice({ type: 'error', text: errorText(error) }); }
  }

  function switchLocale(next) {
    if (dirty && !window.confirm('Kaydedilmemiş değişiklikler silinsin mi?')) return;
    setLocale(next); setNotice(null);
  }

  return <>
    <PageHeader breadcrumb={[{ label: 'Sayfalar', href: '/cms/documents' }, { label: isNew ? 'Yeni' : form.title || 'Düzenle' }]} title={isNew ? 'Yeni Sayfa' : form.title || 'Sayfayı Düzenle'} actions={<div className="flex flex-wrap gap-2">
      {pageId && <Button variant="outline" onClick={translate} disabled={busy || translating}>{translating ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}Dillere Çevir</Button>}
      {pageId && status === 'published' && <a href={publicUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline' })}><ExternalLink className="size-4" />Sitede Gör</a>}
      <Button variant="outline" onClick={togglePublish} disabled={busy}>{publishing || unpublishing ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />}{status === 'published' ? 'Taslağa Al' : 'Yayınla'}</Button>
      <Button onClick={save} disabled={busy || !form.title.trim()}>{creating || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Kaydet</Button>
    </div>} />

    {notice && <Alert variant={notice.type === 'error' ? 'destructive' : 'info'} className="mb-4"><AlertTitle>{notice.type === 'error' ? 'İşlem başarısız' : 'Tamamlandı'}</AlertTitle><AlertDescription>{notice.text}</AlertDescription></Alert>}

    <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1.5">
      {CONTENT_LOCALES.map((language) => { const entry = locales.find((item) => item.locale === language.code); return <button key={language.code} type="button" disabled={isNew && language.code !== 'tr'} onClick={() => switchLocale(language.code)} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', locale === language.code ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent', isNew && language.code !== 'tr' && 'opacity-40')}><span className="uppercase">{language.code}</span>{entry && <Check className={cn('size-3', entry.status === 'published' && 'text-green-500')} />}</button>; })}
      <Badge variant={status === 'published' ? 'success' : 'muted'} className="ms-auto">{status === 'published' ? 'Yayında' : 'Taslak'}</Badge>
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card><CardContent className="space-y-4 p-5"><Input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Sayfa başlığı" className="h-12 text-lg font-semibold" /><textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} placeholder="Kısa sayfa açıklaması" className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30" /></CardContent></Card>
        <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">{[['content', 'İçerik'], ['seo', 'SEO ve Paylaşım']].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={cn('flex-1 rounded-lg py-2 text-sm font-medium', tab === key ? 'bg-background shadow-sm' : 'text-muted-foreground')}>{label}</button>)}</div>
        {tab === 'content' ? <Card><CardHeader><CardTitle>Sayfa İçeriği · {locale.toUpperCase()}</CardTitle></CardHeader><CardContent className="p-4"><PageWysiwygEditor value={form.contentHtml} onChange={(html) => update('contentHtml', html)} locale={locale} /></CardContent></Card> : <SeoPanel form={form} updateSeo={updateSeo} seoTitle={seoTitle} seoDescription={seoDescription} publicUrl={publicUrl} alternates={data?.alternates || []} />}
      </div>

      <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
        <Card><CardHeader><CardTitle>Yayın Adresi</CardTitle></CardHeader><CardContent className="space-y-4 p-4"><div><label className="mb-1 block text-xs text-muted-foreground">Route klasörü</label><Input value={form.routePath} onChange={(e) => update('routePath', e.target.value)} placeholder="/document veya /rehber" className="font-mono text-xs" /></div><div><label className="mb-1 block text-xs text-muted-foreground">Slug</label><Input value={form.slug} onChange={(e) => update('slug', slugify(e.target.value))} placeholder={slugify(form.title) || 'sayfa-slug'} className="font-mono text-xs" /></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Canlı adres</p><p className="mt-1 break-all font-mono text-xs text-primary">{publicUrl}</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Ayarlar</CardTitle></CardHeader><CardContent className="space-y-4 p-4"><div><label className="mb-1 block text-xs text-muted-foreground">Kategori</label><Select value={form.category || 'none'} onValueChange={(value) => update('category', value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Kategorisiz</SelectItem>{categories.map((category) => <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>)}</SelectContent></Select></div>{dirty && <p className="text-xs font-medium text-amber-600">Kaydedilmemiş değişiklikler var.</p>}<Link href="/cms/documents" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>Listeye Dön</Link></CardContent></Card>
      </div>
    </div>
  </>;
}

function SeoPanel({ form, updateSeo, seoTitle, seoDescription, publicUrl, alternates }) {
  return <div className="space-y-5"><Card><CardHeader><CardTitle>Arama Motoru Ayarları</CardTitle></CardHeader><CardContent className="space-y-4 p-5"><Field label={`SEO başlığı · ${form.seo.title.length}/60`}><Input value={form.seo.title} onChange={(e) => updateSeo('title', e.target.value)} placeholder={form.title || 'SEO başlığı'} /></Field><Field label={`Meta açıklama · ${form.seo.description.length}/160`}><textarea value={form.seo.description} onChange={(e) => updateSeo('description', e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder={form.description || 'Arama sonucu açıklaması'} /></Field><Field label="Canonical URL"><Input value={form.seo.canonicalUrl} onChange={(e) => updateSeo('canonicalUrl', e.target.value)} placeholder={publicUrl} /></Field><div className="grid gap-3 sm:grid-cols-2"><Toggle label="Arama motorları indekslesin" checked={form.seo.index} onChange={(value) => updateSeo('index', value)} /><Toggle label="Bağlantıları takip etsin" checked={form.seo.follow} onChange={(value) => updateSeo('follow', value)} /></div><Field label="Yapılandırılmış veri"><Select value={form.seo.schemaType} onValueChange={(value) => updateSeo('schemaType', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WebPage">WebPage</SelectItem><SelectItem value="Article">Article</SelectItem><SelectItem value="TechArticle">TechArticle</SelectItem></SelectContent></Select></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>Sosyal Paylaşım</CardTitle></CardHeader><CardContent className="space-y-4 p-5"><Field label="OG başlığı"><Input value={form.seo.ogTitle} onChange={(e) => updateSeo('ogTitle', e.target.value)} placeholder={seoTitle} /></Field><Field label="OG açıklaması"><Input value={form.seo.ogDescription} onChange={(e) => updateSeo('ogDescription', e.target.value)} placeholder={seoDescription} /></Field><Field label="OG görseli"><Input value={form.seo.ogImage} onChange={(e) => updateSeo('ogImage', e.target.value)} placeholder="https://…" /></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>Google Önizlemesi</CardTitle></CardHeader><CardContent className="p-5"><p className="break-all text-xs text-green-700">{form.seo.canonicalUrl || publicUrl}</p><p className="mt-1 text-xl text-blue-700">{seoTitle}</p><p className="mt-1 text-sm text-muted-foreground">{seoDescription}</p></CardContent></Card>
    <Card><CardHeader><CardTitle>Hreflang</CardTitle></CardHeader><CardContent className="space-y-2 p-5">{alternates.length ? alternates.map((item) => <div key={item.locale} className="flex gap-3 text-xs"><Badge variant="outline">{item.locale}</Badge><span className="break-all font-mono text-muted-foreground">{item.fullPath}</span></div>) : <p className="text-sm text-muted-foreground">Yayınlanmış dil alternatifi henüz yok.</p>}</CardContent></Card></div>;
}

function Field({ label, children }) { return <div><label className="mb-1 block text-xs text-muted-foreground">{label}</label>{children}</div>; }
function Toggle({ label, checked, onChange }) { return <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-sm"><span>{label}</span><span className={cn('relative h-6 w-11 rounded-full', checked ? 'bg-primary' : 'bg-muted')}><span className={cn('absolute top-0.5 size-5 rounded-full bg-white transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} /></span></button>; }
