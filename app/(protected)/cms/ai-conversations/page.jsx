'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Inbox, Bot, User as UserIcon } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES } from '@/lib/roles';
import { useGetCmsConversationsQuery } from '@/redux/services';

const PAGE_SIZE = 20;

const TYPE_META = {
  general: { label: 'Genel', variant: 'muted' },
  assistant: { label: 'Asistan', variant: 'primary' },
};
const STATUS_META = {
  active: { label: 'Aktif', variant: 'success' },
  completed: { label: 'Tamamlandı', variant: 'secondary' },
};

function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

function ConversationsSection() {
  const router = useRouter();
  const [type, setType] = useState('general');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // Basit debounce — her tuş vuruşunda istek atma.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, isFetching, isError, refetch } = useGetCmsConversationsQuery({
    type,
    q: q || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      {/* Filtreler */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tür" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Genel</SelectItem>
              <SelectItem value="assistant">Asistan</SelectItem>
              <SelectItem value="all">Tümü</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Başlık / özet ara…"
            className="w-[240px]"
          />
          <span className="text-xs text-muted-foreground">{total} konuşma</span>
          <div className="ms-auto">
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tablo */}
      <Card>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Yüklenemedi</AlertTitle>
                <AlertDescription>
                  Konuşma listesi alınamadı. Bu sayfa gerçek bir oturum ve <code>cms:admin</code> yetkisi gerektirir.
                </AlertDescription>
              </Alert>
            </div>
          ) : isFetching && items.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Konuşma bulunamadı</p>
              <p className="text-sm text-muted-foreground">Seçilen tür/aramaya uygun konuşma yok.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead className="text-right">Mesaj</TableHead>
                    <TableHead className="text-right">Token</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Son Güncelleme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => {
                    const tm = TYPE_META[c.type] || TYPE_META.general;
                    const sm = STATUS_META[c.status] || { label: c.status || '—', variant: 'muted' };
                    return (
                      <TableRow
                        key={c.conversationid || c.id}
                        className="cursor-pointer"
                        onClick={() => c.conversationid && router.push(`/cms/ai-conversations/${c.conversationid}`)}
                      >
                        <TableCell className="max-w-[180px] truncate">
                          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                            <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{c.userName || 'Kullanıcı'}</span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <div className="truncate font-medium text-foreground">{c.title || 'Başlıksız konuşma'}</div>
                          {c.summary && c.summary !== 'no summary' && (
                            <div className="truncate text-xs text-muted-foreground">{c.summary}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tm.variant}>
                            {c.type === 'assistant' && <Bot className="size-3" />}{tm.label}
                          </Badge>
                          {c.type === 'assistant' && c.assistant?.title && (
                            <div className="mt-0.5 max-w-[140px] truncate text-[11px] text-muted-foreground">{c.assistant.title}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{c.messageCount ?? 0}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{(c.totalTokens ?? 0).toLocaleString('tr-TR')}</TableCell>
                        <TableCell><Badge variant={sm.variant}>{sm.label}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(c.updatedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki</Button>
        </div>
      )}
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Yapay Zeka"
        title="Konuşmalar"
        description="Kullanıcıların AI ile yaptığı tüm konuşmalar — kim konuştu, kaç mesaj ve ne kadar token harcandı"
      />
      <ConversationsSection />
    </RoleGuard>
  );
}
