'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Files as FilesIcon, Search, RefreshCw, Inbox, ExternalLink, Eye,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
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
import { FileDetailSheet } from './_components/file-detail-sheet';
import { MEDIA_META, SOURCE_META, formatBytes, formatTr } from './_lib/file-meta';

const PAGE_SIZE = 30;

function FileCard({ f, onOpen }) {
  const meta = MEDIA_META[f.mediaType] || MEDIA_META.file;
  const Icon = meta.icon;
  const isImage = f.mediaType === 'image' && f.url;
  const source = SOURCE_META[f.sourceGroup] || SOURCE_META.media;

  return (
    <Card className="group overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(f.id)}
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted/40"
        title="Detay ve içeriği görüntüle"
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.url} alt={f.name} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <Icon className={cn('size-10', meta.tone)} />
        )}
        <Badge variant="muted" className="absolute left-1.5 top-1.5 text-[10px]">{meta.label}</Badge>
        <Badge variant={source.badge} className="absolute bottom-1.5 left-1.5 text-[10px]">
          {source.label}
        </Badge>
        <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm">
            <Eye className="size-3.5" /> İçeriği gör
          </span>
        </span>
      </button>
      <CardContent className="space-y-0.5 p-2.5">
        <p className="truncate text-sm font-medium text-foreground" title={f.name}>{f.name || f.originalName || '—'}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatBytes(f.sizeBytes)}</span>
          <span>{formatTr(f.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          {f.owner ? (
            <p className="truncate text-[11px] text-muted-foreground">{f.owner}</p>
          ) : <span />}
          {f.url && (
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Yeni sekmede aç"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FilesLibraryPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [mediaType, setMediaType] = useState('all');
  const [source, setSource] = useState('all');
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState(null);

  const stats = useGetFileStatsQuery({ status }, { skip: !authorized });
  const groups = stats.data?.groups ?? [];
  const sources = stats.data?.sources ?? [];

  const params = { status, limit: PAGE_SIZE, skip: page * PAGE_SIZE };
  if (mediaType !== 'all') params.mediaType = mediaType;
  if (source !== 'all') params.source = source;
  if (search) params.q = search;
  const { data, isFetching, isError, refetch } = useGetFilesQuery(params, { skip: !authorized });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submit = () => { setPage(0); setSearch(q.trim()); };
  const pickType = (t) => { setMediaType(t); setPage(0); };
  const pickSource = (s) => { setSource(s); setPage(0); };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Sistem Ayarları"
        title="Eklenen Dosyalar"
        description="Upload servisiyle eklenen tüm dosyalar (files koleksiyonu) — kaynağına ve medya tipine göre gruplu"
        actions={
          <Button variant="outline" onClick={() => { refetch(); stats.refetch(); }} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Yenile
          </Button>
        }
      />

      {/* Kaynak ayrımı: kütüphaneye eklenen / konuşmada eklenen / AI üretimi */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => pickSource('all')}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-2sm transition-colors',
            source === 'all' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-accent',
          )}
        >
          Tüm kaynaklar
          <span className="ms-2 tabular-nums text-muted-foreground">{stats.data?.total ?? 0}</span>
        </button>
        {sources.map((s) => (
          <button
            key={s.source}
            onClick={() => pickSource(s.source)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-2sm transition-colors',
              source === s.source ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-accent',
            )}
          >
            {SOURCE_META[s.source]?.label || s.label}
            <span className="ms-2 tabular-nums text-muted-foreground">{s.count}</span>
          </button>
        ))}
      </div>

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
          const meta = MEDIA_META[g.mediaType] || MEDIA_META.file;
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
            {items.map((f) => <FileCard key={f.id} f={f} onOpen={setDetailId} />)}
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

      <FileDetailSheet
        fileId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </RoleGuard>
  );
}
