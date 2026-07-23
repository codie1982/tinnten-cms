'use client';

import { use, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Lock, Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { SplitShell, EmptyState } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetSupportTicketQuery,
  useReplySupportTicketMutation,
  useUpdateSupportTicketStatusMutation,
} from '@/redux/services';
import {
  agentStatusOptions,
  closedByMeta,
  formatDate,
  metaOf,
  priorityMeta,
  requesterLabel,
  statusMeta,
} from '../../_data';

export default function SupportTicketDetailPage({ params }) {
  // Next 15: `params` bir Promise — doğrudan `params.ticketId` okunamaz.
  const { ticketId } = use(params);

  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.SUPPORT]);

  const { data: ticket, isLoading, error } = useGetSupportTicketQuery(ticketId, {
    skip: !authorized,
  });
  const [replyTicket, { isLoading: replying }] = useReplySupportTicketMutation();
  const [updateStatus, { isLoading: updatingStatus }] = useUpdateSupportTicketStatusMutation();

  // ⚠️ Varsayılan YOK. Ajan her yanıtta bilinçli seçim yapmak zorunda:
  // sessiz bir varsayılan, iç notun müşteriye gitmesi riskini taşır.
  const [visibility, setVisibility] = useState(null);
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState('');

  const isInternal = visibility === 'internal';
  const canSend = Boolean(visibility) && body.trim().length > 0 && !replying;

  const handleSend = async () => {
    setFormError('');
    if (!visibility) {
      setFormError('Önce yanıt türünü seçin.');
      return;
    }
    try {
      await replyTicket({ id: ticketId, body: body.trim(), visibility }).unwrap();
      setBody('');
      setVisibility(null);
    } catch (err) {
      setFormError(err?.data?.message || 'Yanıt gönderilemedi.');
    }
  };

  const handleStatus = async (nextStatus) => {
    setFormError('');
    // Zorla kapatmada gerekçe zorunlu: kullanıcı "destek ekibi kapattı"
    // bilgisini görüyor, gerekçesiz kapanış müşteride karşılıksız kalıyor.
    let closeReason = '';
    if (nextStatus === 'closed') {
      closeReason = window.prompt('Kapatma gerekçesi (müşteriye gösterilir):') || '';
      if (!closeReason.trim()) {
        setFormError('Kapatma gerekçesi zorunludur.');
        return;
      }
    }
    try {
      await updateStatus({ id: ticketId, status: nextStatus, closeReason }).unwrap();
    } catch (err) {
      setFormError(err?.data?.message || 'Durum güncellenemedi.');
    }
  };

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.SUPPORT]}>
        <PageHeader section="Destek Masası" title="Talep yükleniyor…" />
        <Skeleton className="h-64 w-full" />
      </RoleGuard>
    );
  }

  if (error || !ticket) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.SUPPORT]}>
        <PageHeader section="Destek Masası" title="Talep" />
        <Alert variant="destructive">
          <AlertTitle>Talep bulunamadı</AlertTitle>
          <AlertDescription>
            {error?.data?.message || 'Bu talep silinmiş veya erişim yetkiniz olmayabilir.'}
          </AlertDescription>
        </Alert>
      </RoleGuard>
    );
  }

  const st = metaOf(statusMeta, ticket.status);
  const pr = metaOf(priorityMeta, ticket.priority);
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];

  const aside = (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Müşteri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{requesterLabel(ticket)}</span>
            {ticket.isAnonymous && (
              <Badge variant="outline" className="text-[10px]">Anonim</Badge>
            )}
          </div>
          {ticket.contact?.email && (
            <p className="text-muted-foreground">{ticket.contact.email}</p>
          )}
          {ticket.contact?.phone && (
            <p className="text-muted-foreground">{ticket.contact.phone}</p>
          )}
        </CardContent>
      </Card>

      {/* Kullanıcının bulunduğu ekran/kaynak — allowlist ile toplanır, ham
          istemci verisi değildir (backend Joi context şeması). */}
      {ticket.context && Object.keys(ticket.context).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bağlam</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {Object.entries(ticket.context).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <span className="shrink-0">{key}</span>
                <span className="truncate text-right text-foreground" title={String(value)}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Durum</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            <Badge variant={pr.variant}>{pr.label}</Badge>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            {agentStatusOptions
              .filter((s) => s !== ticket.status)
              .map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={updatingStatus}
                  onClick={() => handleStatus(s)}
                >
                  {statusMeta[s]?.label || s}
                </Button>
              ))}
          </div>

          {ticket.closedByType && (
            <p className="text-xs text-muted-foreground">
              {closedByMeta[ticket.closedByType] || 'Kapatıldı'} · {formatDate(ticket.closedAt)}
              {ticket.closeReason ? ` — ${ticket.closeReason}` : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* İç notlar — bu kart YALNIZ CMS'te render edilir. Kullanıcı API'si
          `internalNotes`'u presenter allowlist'inde taşımaz. */}
      {Array.isArray(ticket.internalNotes) && ticket.internalNotes.length > 0 && (
        <Card className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lock className="size-3.5" />
              İç Notlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {ticket.internalNotes.map((note, i) => (
              <p key={i} className="text-muted-foreground">{note}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.SUPPORT]}>
      <PageHeader
        breadcrumb={[
          { label: 'Destek Masası' },
          { label: 'Talepler', href: '/cms/support/tickets' },
          { label: ticket.ticketNumber || 'Talep' },
        ]}
        title={ticket.title}
        description={`Oluşturma: ${formatDate(ticket.createdAt)}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/cms/support/tickets">
              <ArrowLeft className="size-4" />
              Kuyruğa dön
            </Link>
          </Button>
        }
      />

      <SplitShell aside={aside}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Konuşma</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">İlk açıklama</p>
              <p className="whitespace-pre-wrap">{ticket.summary}</p>
            </div>

            {messages.length === 0 ? (
              <EmptyState
                title="Henüz mesaj yok"
                description="Bu talebe ilk yanıtı siz yazacaksınız."
              />
            ) : (
              messages.map((message, i) => {
                const internal = message.visibility === 'internal';
                const fromAgent = message.senderType === 'agent';

                return (
                  <div
                    key={message._id || i}
                    className={cn(
                      'rounded-lg border p-3 text-sm',
                      // İç notlar sarı şerit + kilit ile ayrılır: yalnız rozet
                      // yeterli değil, ajan akışı hızla tararken karıştırır.
                      internal
                        ? 'border-l-4 border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                        : fromAgent
                          ? 'bg-primary/5'
                          : 'bg-background',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {internal && <Lock className="size-3" />}
                      <span className="font-medium">
                        {internal
                          ? 'İç not'
                          : fromAgent
                            ? 'Destek ekibi'
                            : message.senderType === 'system'
                              ? 'Sistem'
                              : 'Müşteri'}
                      </span>
                      <span>·</span>
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </div>
                );
              })
            )}
          </CardContent>

          {/* ── Composer ─────────────────────────────────────────────────────
              Bu modülün en riskli öğesi: yanlış seçim iç notu müşteriye
              gönderir. Üç katmanlı önlem:
                1) varsayılan yok — bilinçli seçim zorunlu
                2) iç not modunda arka plan sararır + kilit görünür
                3) gönder butonunun ETİKETİ moda göre değişir
          ─────────────────────────────────────────────────────────────────── */}
          <CardContent className="border-t pt-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={visibility === 'public' ? 'primary' : 'outline'}
                onClick={() => setVisibility('public')}
              >
                Müşteriye yanıt
              </Button>
              <Button
                type="button"
                size="sm"
                variant={isInternal ? 'primary' : 'outline'}
                onClick={() => setVisibility('internal')}
              >
                <Lock className="size-3.5" />
                İç not (müşteri görmez)
              </Button>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={
                visibility === null
                  ? 'Önce yukarıdan yanıt türünü seçin…'
                  : isInternal
                    ? 'Ekip içi not — müşteriye GÖSTERİLMEZ'
                    : 'Müşteriye gidecek yanıt'
              }
              disabled={visibility === null}
              className={cn(
                'w-full rounded-md border p-3 text-sm outline-none transition',
                'focus-visible:ring-2 focus-visible:ring-primary/40',
                isInternal
                  ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/20'
                  : 'border-input bg-background',
                visibility === null && 'cursor-not-allowed opacity-60',
              )}
            />

            {formError && (
              <p className="mt-2 text-xs text-destructive">{formError}</p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {isInternal
                  ? 'Bu not yalnız destek ekibine görünür.'
                  : visibility === 'public'
                    ? 'Bu yanıt müşteriye e-posta ile iletilir.'
                    : 'Yanıt türü seçilmedi.'}
              </p>
              <Button onClick={handleSend} disabled={!canSend}>
                <Send className="size-4" />
                {isInternal ? 'İç not ekle' : 'Müşteriye gönder'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </SplitShell>
    </RoleGuard>
  );
}
