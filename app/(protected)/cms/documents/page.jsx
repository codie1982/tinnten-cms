'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, FileText, Loader2, Plus, Search } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CONTENT_LOCALES } from '@/config/api';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetDocCategoriesQuery, useGetDocPagesQuery } from '@/redux/services';

const date = (value) => value ? new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function DocumentsList() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const query = params.get('query') || '';
  const category = params.get('category') || 'all';
  const locale = params.get('locale') || 'all';
  const status = params.get('status') || 'all';
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const limit = [10, 20, 50].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 20;
  const [search, setSearch] = useState(query);
  const { data: categories = [] } = useGetDocCategoriesQuery(locale === 'all' ? 'tr' : locale, { skip: !authorized });
  const request = useMemo(() => ({ query: query || undefined, category: category === 'all' ? undefined : category, locale: locale === 'all' ? undefined : locale, status: status === 'all' ? undefined : status, page, limit }), [query, category, locale, status, page, limit]);
  const { data, isLoading, isFetching, error } = useGetDocPagesQuery(request, { skip: !authorized });
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function setParam(key, value, resetPage = true) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === 'all') next.delete(key); else next.set(key, String(value));
    if (resetPage) next.set('page', '1');
    router.replace(`/cms/documents?${next.toString()}`);
  }

  return <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
    <PageHeader section="İçerik" title="Sayfalar" description="Çok dilli sayfaları, SEO bilgilerini ve yayın adreslerini yönetin" actions={<Link href="/cms/documents/new" className={buttonVariants()}><Plus className="size-4" />Yeni Sayfa</Link>} />
    <Card className="mb-5"><CardContent className="flex flex-wrap gap-3 p-4">
      <div className="relative min-w-60 flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setParam('query', search.trim())} placeholder="Başlık, slug veya path ara…" className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" /></div>
      <Button variant="outline" onClick={() => setParam('query', search.trim())}>Ara</Button>
      <Select value={category} onValueChange={(value) => setParam('category', value)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm kategoriler</SelectItem>{categories.map((item) => <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={locale} onValueChange={(value) => setParam('locale', value)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm diller</SelectItem>{CONTENT_LOCALES.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={(value) => setParam('status', value)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm durumlar</SelectItem><SelectItem value="published">Yayında</SelectItem><SelectItem value="draft">Taslak</SelectItem></SelectContent></Select>
    </CardContent></Card>
    <Card><CardContent className="relative p-0">
      {isFetching && !isLoading && <div className="absolute inset-0 z-10 grid place-items-center bg-background/60"><Loader2 className="size-6 animate-spin" /></div>}
      {error ? <div className="p-4"><Alert variant="destructive"><AlertTitle>Sayfalar yüklenemedi</AlertTitle><AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription></Alert></div> : isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-8" />)}</div> : !items.length ? <div className="grid place-items-center gap-2 py-16 text-center"><FileText className="size-7 text-muted-foreground" /><p className="font-medium">Sayfa bulunamadı</p><p className="text-sm text-muted-foreground">Yeni bir sayfa oluşturabilir veya filtreleri temizleyebilirsiniz.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sayfa</TableHead><TableHead>Kategori</TableHead><TableHead>Diller</TableHead><TableHead>Güncellenme</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.pageId}><TableCell className="max-w-md"><Link href={`/cms/documents/${item.pageId}`} className="font-medium hover:text-primary">{item.title}</Link><p className="truncate font-mono text-xs text-muted-foreground">{item.fullPath}</p></TableCell><TableCell className="text-sm text-muted-foreground">{item.category?.name || '—'}</TableCell><TableCell><div className="flex flex-wrap gap-1">{item.locales?.map((entry) => <Badge key={entry.locale} variant={entry.status === 'published' ? 'success' : 'muted'}>{entry.locale.toUpperCase()}</Badge>)}</div></TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{date(item.updatedAt)}</TableCell></TableRow>)}</TableBody></Table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Sayfa {page} / {totalPages} · {data?.total || 0} kayıt</span><Select value={String(limit)} onValueChange={(value) => setParam('limit', value)}><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 50].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setParam('page', page - 1, false)}><ChevronLeft className="size-4" />Önceki</Button><Button size="sm" variant="outline" disabled={page >= totalPages || isFetching} onClick={() => setParam('page', page + 1, false)}>Sonraki<ChevronRight className="size-4" /></Button></div></div>
    </CardContent></Card>
  </RoleGuard>;
}

export default function DocumentsPage() { return <Suspense fallback={<Skeleton className="h-96" />}><DocumentsList /></Suspense>; }
