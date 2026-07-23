'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Phone, Check, PhoneOff } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, SkeletonRows } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetSupportCallbacksQuery,
  useConfirmSupportCallbackMutation,
  useRecordSupportCallbackOutcomeMutation,
} from '@/redux/services';
import { callbackStatusMeta, formatDate, metaOf } from '../_data';

/**
 * Kullanıcının bildirdiği pencereyi HEM kendi saat diliminde HEM ajanın
 * yerel saatinde gösterir.
 *
 * Tek saat göstermek yanlış aramaya yol açar: kullanıcı "10-12" derken kendi
 * saat dilimini kastediyor, ajan kendi saatini okuyor.
 */
function WindowCell({ callback }) {
  const windows = Array.isArray(callback.preferredWindows) ? callback.preferredWindows : [];
  if (windows.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="space-y-1">
      {windows.map((w, i) => (
        <div key={i} className="text-xs">
          <span className="font-medium">{w.date}</span>{' '}
          <span className="text-muted-foreground">{w.slotKey}</span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">
        müşteri saat dilimi: {callback.timezone || '—'}
      </p>
    </div>
  );
}

export default function SupportCallbacksPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.SUPPORT]);

  const [status, setStatus] = useState('');

  const { data: callbacks = [], isLoading, isFetching, error } = useGetSupportCallbacksQuery(
    { ...(status ? { status } : {}), limit: 50 },
    { skip: !authorized },
  );

  const [confirmCallback, { isLoading: confirming }] = useConfirmSupportCallbackMutation();
  const [recordOutcome, { isLoading: recording }] = useRecordSupportCallbackOutcomeMutation();
  const [actionError, setActionError] = useState('');

  const handleConfirm = async (id) => {
    setActionError('');
    const input = window.prompt(
      'Görüşme saati (YYYY-AA-GG SS:DD, kendi saat diliminizde):',
    );
    if (!input) return;

    const startsAt = new Date(input.replace(' ', 'T'));
    if (Number.isNaN(startsAt.getTime())) {
      setActionError('Geçersiz tarih/saat biçimi.');
      return;
    }

    try {
      await confirmCallback({ id, startsAt: startsAt.toISOString() }).unwrap();
    } catch (err) {
      setActionError(err?.data?.message || 'Görüşme saati onaylanamadı.');
    }
  };

  const handleOutcome = async (id, result) => {
    setActionError('');
    const outcome = window.prompt(
      result === 'completed' ? 'Görüşme notu:' : 'Not (opsiyonel):',
    );
    if (result === 'completed' && !outcome) return;

    try {
      await recordOutcome({ id, result, outcome: outcome || '' }).unwrap();
    } catch (err) {
      setActionError(err?.data?.message || 'Sonuç kaydedilemedi.');
    }
  };

  const busy = confirming || recording;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.SUPPORT]}>
      <PageHeader
        section="Destek Masası"
        title="Geri Arama Kuyruğu"
        description="Telefonla görüşme taleplerini onaylayın ve sonuçlandırın."
      />

      <Alert className="mb-5">
        <AlertTitle>Bu bir randevu sistemi değildir</AlertTitle>
        <AlertDescription>
          Müşteri uygun gördüğü aralıkları bildirir; kesin saati siz belirleyip onaylarsınız.
          Kapasite/çakışma kontrolü yapılmaz.
        </AlertDescription>
      </Alert>

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Durum filtresi"
          >
            <option value="">Tüm durumlar</option>
            {Object.keys(callbackStatusMeta).map((key) => (
              <option key={key} value={key}>
                {callbackStatusMeta[key].label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {(error || actionError) && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>İşlem tamamlanamadı</AlertTitle>
          <AlertDescription>
            {actionError || error?.data?.message || 'Beklenmeyen bir hata oluştu.'}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Talepler</CardTitle>
          <CardToolbar>
            <Badge variant="muted">
              {isFetching ? 'yükleniyor…' : `${callbacks.length} kayıt`}
            </Badge>
          </CardToolbar>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <SkeletonRows rows={5} cols={6} />
            </div>
          ) : callbacks.length === 0 ? (
            <EmptyState
              icon={<Phone className="size-5" />}
              title="Geri arama talebi yok"
              description="Müşteriler telefonla görüşme talep ettiğinde burada görünür."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Tercih Edilen Aralıklar</TableHead>
                    <TableHead>Konu</TableHead>
                    <TableHead>Onaylanan Saat</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callbacks.map((callback) => {
                    const id = callback._id || callback.id;
                    const meta = metaOf(callbackStatusMeta, callback.status);
                    const isActive = ['requested', 'confirmed'].includes(callback.status);

                    return (
                      <TableRow key={id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-sm">{callback.phone}</TableCell>
                        <TableCell><WindowCell callback={callback} /></TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="block truncate text-sm" title={callback.topic}>
                            {callback.topic || '—'}
                          </span>
                          {callback.ticketId && (
                            <Link
                              href={`/cms/support/tickets/${callback.ticketId}`}
                              className="text-xs text-primary hover:underline"
                            >
                              Talebi aç
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {callback.confirmedSlot?.startsAt
                            ? formatDate(callback.confirmedSlot.startsAt)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {callback.status === 'requested' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => handleConfirm(id)}
                              >
                                <Check className="size-3.5" />
                                Onayla
                              </Button>
                            )}
                            {isActive && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => handleOutcome(id, 'completed')}
                                >
                                  Tamamlandı
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => handleOutcome(id, 'no_answer')}
                                >
                                  <PhoneOff className="size-3.5" />
                                  Cevap yok
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
