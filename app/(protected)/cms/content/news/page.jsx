'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Sparkles,
  Eye,
  Pencil,
  Trash2,
  Globe,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { CMS_ROLES } from '@/lib/roles';
import { newsMock, statusMeta } from './_data';

/* ─── AI Generate Modal ─── */
const AI_COUNTRIES = ['TR', 'US', 'GB', 'DE', 'FR', 'ES', 'AR', 'GR', 'GLOBAL'];
const AI_CONTENT_TYPES = [
  { value: 'richSections', label: 'Zengin Bölümler' },
  { value: 'sections', label: 'Bölümler' },
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' },
];

function AIGenerateModal({ onClose }) {
  const [phase, setPhase] = useState('form'); // form | loading | done
  const [form, setForm] = useState({
    topic: '',
    direction: '',
    categoryId: '',
    country: 'TR',
    wordCount: '800',
    contentType: 'richSections',
  });

  function handleGenerate() {
    if (!form.topic) return;
    setPhase('loading');
    setTimeout(() => setPhase('done'), 2200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
              <Sparkles className="size-4" />
            </div>
            <CardTitle>Yapay Zeka ile Haber Oluştur</CardTitle>
          </div>
          <CardToolbar>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent>
          {phase === 'form' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Konu / Başlık *</label>
                <input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="örn. Türkiye'de B2B e-ticaret büyümesi"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Yön / Ek Bağlam</label>
                <textarea
                  value={form.direction}
                  onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                  rows={2}
                  placeholder="Analitik, pozitif/negatif bakış açısı, vurgulanacak konular..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-2sm font-medium">Ülke</label>
                  <Select value={form.country} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AI_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-2sm font-medium">Kelime Sayısı</label>
                  <Select value={form.wordCount} onValueChange={(v) => setForm((f) => ({ ...f, wordCount: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['400', '600', '800', '1200', '1600'].map((n) => (
                        <SelectItem key={n} value={n}>{n} kelime</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">İçerik Formatı</label>
                <Select value={form.contentType} onValueChange={(v) => setForm((f) => ({ ...f, contentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_CONTENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>İptal</Button>
                <Button onClick={handleGenerate} disabled={!form.topic}>
                  <Sparkles className="size-4" />
                  Oluştur
                </Button>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative flex size-16 items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <Sparkles className="size-6 text-primary" />
              </div>
              <div className="space-y-1 text-center">
                <p className="font-medium">İçerik oluşturuluyor…</p>
                <p className="text-sm text-muted-foreground">Bu işlem birkaç saniye sürebilir.</p>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-7" />
              </div>
              <div className="space-y-1 text-center">
                <p className="font-medium">Haber oluşturuldu!</p>
                <p className="text-sm text-muted-foreground">Taslak kaydedildi. Listede görüntüleyebilirsiniz.</p>
              </div>
              <Button onClick={onClose}>Listeye Dön</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── page ─── */
export default function NewsListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, [search, statusFilter, categoryFilter]);

  const filtered = useMemo(() =>
    newsMock
      .filter((n) => statusFilter === 'all' || n.status === statusFilter)
      .filter((n) => categoryFilter === 'all' || n.category.id === categoryFilter)
      .filter((n) =>
        search
          ? [n.title, n.subtitle, ...(n.tags ?? [])].some((f) =>
              f.toLowerCase().includes(search.toLowerCase()),
            )
          : true,
      ),
    [search, statusFilter, categoryFilter],
  );

  const categories = [...new Map(newsMock.map((n) => [n.category.id, n.category])).values()];
  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      {showAI && <AIGenerateModal onClose={() => setShowAI(false)} />}

      <PageHeader
        section="Haberler"
        title="Tüm Haberler"
        description="Platformdaki haber ve makale içeriklerini yönetin"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowAI(true)}>
              <Sparkles className="size-4" />
              AI ile Oluştur
            </Button>
            <Link href="/cms/content/news/new">
              <Button>
                <Plus className="size-4" />
                Yeni Haber
              </Button>
            </Link>
          </div>
        }
      />

      {/* Toolbar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Başlık, etiket veya içerik ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          <div className="w-36">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="published">Yayında</SelectItem>
                <SelectItem value="draft">Taslak</SelectItem>
                <SelectItem value="archived">Arşivlenmiş</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Haber Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{filtered.length} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-12 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                  <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <FileText className="size-6 text-muted-foreground" />
              <p className="font-semibold">Haber bulunamadı</p>
              <p className="text-sm text-muted-foreground">Filtreleri değiştirerek yeniden deneyin.</p>
              <Button size="sm" variant="outline" onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); }}>
                Filtreleri sıfırla
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>Başlık</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Görüntülenme</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((n) => (
                    <TableRow key={n.id}>
                      {/* Thumbnail */}
                      <TableCell className="py-2">
                        {n.imageUrl ? (
                          <img
                            src={n.imageUrl}
                            alt={n.title}
                            className="size-11 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex size-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <FileText className="size-4" />
                          </div>
                        )}
                      </TableCell>
                      {/* Title */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Link
                            href={`/cms/content/news/${n.id}`}
                            className="line-clamp-1 max-w-xs font-medium text-foreground hover:text-primary"
                          >
                            {n.title}
                          </Link>
                          <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                            {n.subtitle}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{n.category.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusMeta[n.status]?.variant}>
                          {statusMeta[n.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {n.viewCount > 0 ? n.viewCount.toLocaleString('tr-TR') : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {n.publishedAt ?? n.updatedAt}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link href={`/cms/content/news/${n.id}`}>
                            <Button variant="ghost" size="icon" className="size-7">
                              <Pencil className="size-3.5" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
