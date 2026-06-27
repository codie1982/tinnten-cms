'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Bot, User as UserIcon, MessageSquare, Coins, Languages, Inbox,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useGetCmsConversationDetailQuery } from '@/redux/services';

const PAGE_SIZE = 50;

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

// Markdown öğe stilleri — @tailwindcss/typography olmadan da okunur kalsın.
const mdComponents = {
  p: ({ node, ...p }) => <p className="my-1.5 leading-relaxed" {...p} />,
  a: ({ node, ...p }) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
  ul: ({ node, ...p }) => <ul className="my-1.5 list-disc space-y-0.5 ps-5" {...p} />,
  ol: ({ node, ...p }) => <ol className="my-1.5 list-decimal space-y-0.5 ps-5" {...p} />,
  li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
  h1: ({ node, ...p }) => <h1 className="mb-1 mt-2 text-base font-semibold" {...p} />,
  h2: ({ node, ...p }) => <h2 className="mb-1 mt-2 text-sm font-semibold" {...p} />,
  h3: ({ node, ...p }) => <h3 className="mb-1 mt-2 text-sm font-semibold" {...p} />,
  pre: ({ node, ...p }) => <pre className="my-2 overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-[12px] leading-relaxed" {...p} />,
  code: ({ node, className, children, ...rest }) => {
    const isBlock = /language-/.test(className || '');
    return isBlock ? (
      <code className={cn('font-mono', className)} {...rest}>{children}</code>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]" {...rest}>{children}</code>
    );
  },
  table: ({ node, ...p }) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-sm" {...p} /></div>,
  th: ({ node, ...p }) => <th className="border border-border bg-muted/50 px-2 py-1 text-start font-medium" {...p} />,
  td: ({ node, ...p }) => <td className="border border-border px-2 py-1 align-top" {...p} />,
  blockquote: ({ node, ...p }) => <blockquote className="my-2 border-s-2 border-border ps-3 text-muted-foreground" {...p} />,
};

function MetaItem({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon className="size-3.5 text-muted-foreground" />}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );
}

function Bubble({ role, name, time, children }) {
  const isAI = role === 'ai';
  const displayName = isAI ? (name || 'AI') : (name || 'Kullanıcı');
  return (
    <div className="flex gap-3">
      <Avatar
        name={displayName}
        size="sm"
        className={isAI ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
          {isAI ? (
            <Badge variant="primary"><Bot className="size-3" />AI</Badge>
          ) : (
            <Badge variant="muted"><UserIcon className="size-3" />Kullanıcı</Badge>
          )}
          <span className="ms-auto whitespace-nowrap font-mono text-[11px] text-muted-foreground">{formatTr(time)}</span>
        </div>
        <div className={cn('rounded-xl border px-3 py-2 text-sm', isAI ? 'border-primary/20 bg-primary/5' : 'border-border bg-card')}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ConversationDetail() {
  const params = useParams();
  const id = params?.id;
  const [page, setPage] = useState(1);

  const { data, isFetching, isError, error } = useGetCmsConversationDetailQuery(
    { id, page, limit: PAGE_SIZE },
    { skip: !id },
  );

  const conversation = data?.conversation;
  const messages = data?.messages ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const assistantName = conversation?.assistant?.title || conversation?.assistant?.asistan_name || 'AI';
  const userName = conversation?.userName || 'Kullanıcı';
  const tm = TYPE_META[conversation?.type] || TYPE_META.general;
  const sm = STATUS_META[conversation?.status] || { label: conversation?.status || '—', variant: 'muted' };

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Konuşma açılamadı</AlertTitle>
        <AlertDescription>
          {error?.status === 404
            ? 'Konuşma bulunamadı.'
            : 'Detay alınamadı. Bu sayfa gerçek bir oturum ve cms:admin yetkisi gerektirir.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {/* Meta kartı */}
      <Card>
        <CardContent className="p-5">
          {isFetching && !conversation ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <MetaItem icon={UserIcon} label="Kullanıcı">{userName}</MetaItem>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Tür:</span>
                  <Badge variant={tm.variant}>{conversation?.type === 'assistant' && <Bot className="size-3" />}{tm.label}</Badge>
                  {conversation?.type === 'assistant' && conversation?.assistant?.title && (
                    <span className="text-xs text-muted-foreground">({conversation.assistant.title})</span>
                  )}
                </div>
                <MetaItem icon={MessageSquare} label="Mesaj">{conversation?.messageCount ?? total}</MetaItem>
                <MetaItem icon={Coins} label="Token">{(conversation?.totalTokens ?? 0).toLocaleString('tr-TR')}</MetaItem>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Durum:</span>
                  <Badge variant={sm.variant}>{sm.label}</Badge>
                </div>
                <MetaItem label="Oluşturma">{formatTr(conversation?.createdAt)}</MetaItem>
              </div>
              {conversation?.summary && conversation.summary !== 'no summary' && (
                <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">{conversation.summary}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sohbet akışı */}
      <Card>
        <CardContent className="p-5">
          {isFetching && messages.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Mesaj yok</p>
              <p className="text-sm text-muted-foreground">Bu konuşmada görüntülenecek mesaj bulunmuyor.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m) => {
                const userText = m.human_message || m.human_translate_message;
                const showTranslate =
                  m.human_translate_message &&
                  m.human_message &&
                  m.human_translate_message !== m.human_message;
                return (
                  <div key={m._id || m.messageid} className="space-y-2.5">
                    {userText && (
                      <Bubble role="user" name={userName} time={m.createdAt}>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.human_message || m.human_translate_message}</p>
                        {showTranslate && (
                          <p className="mt-1.5 flex items-start gap-1 border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
                            <Languages className="mt-0.5 size-3 shrink-0" />
                            <span className="whitespace-pre-wrap">{m.human_translate_message}</span>
                          </p>
                        )}
                      </Bubble>
                    )}
                    {m.system_message && (
                      <Bubble role="ai" name={assistantName} time={m.updatedAt || m.createdAt}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                          {m.system_message}
                        </ReactMarkdown>
                      </Bubble>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mesaj sayfalama */}
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

export default function ConversationDetailPage() {
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[{ label: 'Konuşmalar', href: '/cms/ai-conversations' }, { label: 'Detay' }]}
        title="Konuşma Detayı"
        description="Konuşmadaki tüm mesajlar — kullanıcı ve AI yanıtları, kronolojik sırayla"
        actions={(
          <Link href="/cms/ai-conversations" className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft className="size-4" /> Listeye Dön
          </Link>
        )}
      />
      <ConversationDetail />
    </RoleGuard>
  );
}
