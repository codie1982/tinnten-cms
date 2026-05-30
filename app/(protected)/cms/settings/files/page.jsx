'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Image as ImageIcon, Film, Music, FileText, File, Files as FilesIcon,
  Search, RefreshCw, Inbox, ExternalLink, Download,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useGetFileStatsQuery, useGetFilesQuery } from '@/redux/services';

const PAGE_SIZE = 30;

const MEDIA = {
  image: { label: 'Resim', icon: ImageIcon, tone: 'text-violet-600' },
  video: { label: 'Video', icon: Film, tone: 'text-rose-600' },
  audio: { label: 'Ses', icon: Music, tone: 'text-amber-600' },
  document: { label: 'Doküman', icon: FileText, tone: 'text-sky-600' },
  file: { label: 'Dosya', icon: File, tone: 'text-muted-foreground' },
};

function formatBytes(b) {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function FileCard({ f }) {
  const meta = MEDIA[f.mediaType] || MEDIA.file;
  const Icon = meta.icon;
  const isImage = f.mediaType === 'image' && f.url;

  return (
    <Card className="group overflow-hidden">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted/40">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.url} alt={f.name} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <Icon className={cn('size-10', meta.tone)} />
        )}
        <Badge variant="muted" className="absolute left-1.5 top-1.5 text-[10px]">{meta.label}</Badge>
        {f.url && (
          <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <a href={f.url} target="_blank" rel="noreferrer" className="rounded-md bg-background/80 p-1 hover:bg-background" title="Aç"><ExternalLink className="size-3.5" /></a>
          </div>
        )}
      </div>
      <CardContent className="space-y-0.5 p-2.5">
        <p className="truncate text-sm font-medium text-foreground" title={f.name}>{f.name || f.originalName || '—'}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatBytes(f.sizeBytes)}</span>
          <span>{formatTr(f.createdAt)}</span>
        </div>
        {f.owner && <p className="truncate text-[11px] text-muted-foreground">{f.owner}</p>}
      </CardContent>
    </Card>
  );
}

export default function FilesLibraryPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [mediaType, setMediaType] = useState('all');
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const stats = useGetFileStatsQuery({ status }, { skip: !authorized });
  const groups = stats.data?.groups ?? [];

  const params = { status, limit: PAGE_SIZE, skip: page * PAGE_SIZE };
  if (mediaType !== 'all') params.mediaType = mediaType;
  if (search) params.q = search;
  const { data, isFetching, isError, refetch } = useGetFilesQuery(params, { skip: !authorized });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submit = () => { setPage(0); setSearch(q.trim()); };
  const pickType = (t) => { setMediaType(t); setPage(0); };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Sistem Ayarları"
        title="Eklenen Dosyalar"
        description="Upload servisiyle eklenen tüm dosyalar (files koleksiyonu) — medya tipine göre gruplu"
        actions={
          <Button variant="outline" onClick={() => { refetch(); stats.refetch(); }} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Yenile
          </Button>
        }
      />

      {/* Tip kartları / filtre */}
      <div className="mb-5 grid grid-cols-3 gap-3 lg:grid-cols-6">
        <button
          onClick={() => pickType('all')}
          className={cn('rounded-xl border p-3 text-left transition-colors', mediaType === 'all' ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}
        >
          <div className="flex items-center justify-between"><span className="text-2sm text-muted-foreground">Tümü</span><FilesIcon className="size-4 text-muted-foreground" /></div>
          <p className="mt-1 text-xl font-bold tabular-nums">{stats.isFetching && !stats.data ? '…' : (stats.data?.total ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground">{formatBytes(stats.data?.totalSize)}</p>
        </button>
        {groups.map((g) => {
          const meta = MEDIA[g.mediaType] || MEDIA.file;
          const Icon = meta.icon;
          const active = mediaType === g.mediaType;
          return (
            <button
              key={g.mediaType}
              onClick={() => pickType(g.mediaType)}
              className={cn('rounded-xl border p-3 text-left transition-colors', active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}
            >
              <div className="flex items-center justify-between"><span className="text-2sm text-muted-foreground">{meta.label}</span><Icon className={cn('size-4', meta.tone)} /></div>
              <p className="mt-1 text-xl font-bold tabular-nums">{g.count}</p>
              <p className="text-[11px] text-muted-foreground">{formatBytes(g.size)}</p>
            </button>
          );
        })}
      </div>

      {/* Araçlar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex min-w-[240px] flex-1 items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Dosya adı / etiket ara…" />
            <Button variant="outline" size="icon" onClick={submit}><Search className="size-4" /></Button>
          </div>
          <div className="w-40">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="archived">Arşiv</SelectItem>
                <SelectItem value="deleted">Silinmiş</SelectItem>
                <SelectItem value="all">Tümü</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">{total.toLocaleString('tr-TR')} dosya</span>
        </CardContent>
      </Card>

      {isError ? (
        <Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Dosya listesi alınamadı.</AlertDescription></Alert>
      ) : isFetching && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <Inbox className="size-7 text-muted-foreground" />
          <p className="font-semibold text-foreground">Dosya yok</p>
          <p className="text-sm text-muted-foreground">Bu kriterde dosya bulunmuyor.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((f) => <FileCard key={f.id} f={f} />)}
          </div>
          {total > PAGE_SIZE && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page === 0 || isFetching} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
              <span className="text-xs text-muted-foreground">Sayfa {page + 1} / {pageCount}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= pageCount || isFetching} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
            </div>
          )}
        </>
      )}
    </RoleGuard>
  );
}
