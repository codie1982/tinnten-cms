'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Save, Send, Loader2, ArrowLeft, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetMailCampaignQuery,
  useCreateMailCampaignMutation,
  useUpdateMailCampaignMutation,
  useSendMailCampaignMutation,
  useGetMailChannelsQuery,
  useGetMailTemplatesQuery,
  useGetRecipientCountQuery,
  useGetMailCampaignStatsQuery,
} from '@/redux/services';

const DEFAULT_SEND = {
  ratePerSec: 5,
  batchSize: 500,
  maxRecipients: '',
  circuitBreaker: { enabled: true, bounceRatePct: 3, complaintRatePct: 0.08 },
};

export default function CampaignEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: campaign, isLoading } = useGetMailCampaignQuery(id, { skip: !authorized || isNew });
  const { data: channels = [] } = useGetMailChannelsQuery({}, { skip: !authorized });
  const { data: templates = [] } = useGetMailTemplatesQuery({}, { skip: !authorized });

  const [createCampaign, { isLoading: creating }] = useCreateMailCampaignMutation();
  const [updateCampaign, { isLoading: saving }] = useUpdateMailCampaignMutation();
  const [sendCampaign, { isLoading: sending }] = useSendMailCampaignMutation();

  const [form, setForm] = useState({
    name: '',
    channelKey: '',
    templateId: '',
    subjectOverride: '',
    sendConfig: DEFAULT_SEND,
  });
  const [vars, setVars] = useState([]); // [{key, value}]
  const [notice, setNotice] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);

  const status = campaign?.status || 'draft';
  const isDraft = isNew || status === 'draft';

  const { data: recipientInfo } = useGetRecipientCountQuery(form.channelKey, {
    skip: !authorized || !form.channelKey,
  });
  const { data: statsData } = useGetMailCampaignStatsQuery(id, {
    skip: !authorized || isNew || status === 'draft',
  });

  useEffect(() => {
    if (campaign) {
      setForm({
        name: campaign.name || '',
        channelKey: campaign.channelKey || '',
        templateId: campaign.templateId || '',
        subjectOverride: campaign.subjectOverride || '',
        sendConfig: {
          ratePerSec: campaign.sendConfig?.ratePerSec ?? 5,
          batchSize: campaign.sendConfig?.batchSize ?? 500,
          maxRecipients: campaign.sendConfig?.maxRecipients ?? '',
          circuitBreaker: {
            enabled: campaign.sendConfig?.circuitBreaker?.enabled !== false,
            bounceRatePct: campaign.sendConfig?.circuitBreaker?.bounceRatePct ?? 3,
            complaintRatePct: campaign.sendConfig?.circuitBreaker?.complaintRatePct ?? 0.08,
          },
        },
      });
      setVars(Object.entries(campaign.globalVars || {}).map(([key, value]) => ({ key, value: String(value) })));
    }
  }, [campaign]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSC = (k, v) => setForm((f) => ({ ...f, sendConfig: { ...f.sendConfig, [k]: v } }));
  const setCB = (k, v) =>
    setForm((f) => ({ ...f, sendConfig: { ...f.sendConfig, circuitBreaker: { ...f.sendConfig.circuitBreaker, [k]: v } } }));

  const recipientCount = recipientInfo?.count ?? null;
  const estimateMin = useMemo(() => {
    const n = form.sendConfig.maxRecipients
      ? Math.min(Number(form.sendConfig.maxRecipients), recipientCount ?? Infinity)
      : recipientCount;
    if (!n || !form.sendConfig.ratePerSec) return null;
    return Math.max(1, Math.ceil(n / form.sendConfig.ratePerSec / 60));
  }, [recipientCount, form.sendConfig.maxRecipients, form.sendConfig.ratePerSec]);

  const buildPayload = () => ({
    name: form.name.trim(),
    channelKey: form.channelKey,
    templateId: form.templateId,
    subjectOverride: form.subjectOverride.trim() || null,
    globalVars: Object.fromEntries(vars.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value])),
    sendConfig: {
      ratePerSec: Number(form.sendConfig.ratePerSec) || 5,
      batchSize: Number(form.sendConfig.batchSize) || 500,
      maxRecipients: form.sendConfig.maxRecipients ? Number(form.sendConfig.maxRecipients) : null,
      circuitBreaker: {
        enabled: !!form.sendConfig.circuitBreaker.enabled,
        bounceRatePct: Number(form.sendConfig.circuitBreaker.bounceRatePct) || 3,
        complaintRatePct: Number(form.sendConfig.circuitBreaker.complaintRatePct) || 0.08,
      },
    },
  });

  const save = async () => {
    if (!form.name.trim() || !form.channelKey || !form.templateId) {
      return setNotice('Ad, kanal ve şablon zorunlu.');
    }
    const payload = buildPayload();
    if (isNew) {
      const r = await createCampaign(payload).unwrap().catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
      if (r?.__err) return setNotice(r.__err);
      if (r?._id) router.push(`/cms/email/campaigns/${r._id}`);
    } else {
      const r = await updateCampaign({ id, ...payload }).unwrap().catch((e) => ({ __err: e?.data?.message || 'Kaydedilemedi' }));
      setNotice(r?.__err || 'Kampanya kaydedildi.');
    }
  };

  const doSend = async () => {
    const r = await sendCampaign(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Gönderilemedi' }));
    setConfirmSend(false);
    if (r?.__err) return setNotice(r.__err);
    setNotice(r?.paused ? `Güvenlik nedeniyle duraklatıldı: ${r.reason}` : `Gönderime alındı (${r?.queued ?? 0} alıcı).`);
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email · Kampanya"
        title={isNew ? 'Yeni Kampanya' : form.name || 'Kampanya'}
        description="Onaylı kullanıcılara toplu gönderim — taslak kaydet, sonra gönder"
        actions={
          <div className="flex gap-2">
            <Link href="/cms/email/campaigns"><Button variant="outline"><ArrowLeft className="size-4" /> Liste</Button></Link>
            {isDraft && (
              <Button onClick={save} disabled={creating || saving}>
                {creating || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Taslağı Kaydet
              </Button>
            )}
          </div>
        }
      />

      {notice && <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}

      {!isNew && isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          {/* Sol: form */}
          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Kampanya</CardTitle></CardHeader>
              <CardContent className="space-y-4 p-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Ad</label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} disabled={!isDraft} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">Kanal (alıcı listesi)</label>
                    <select value={form.channelKey} onChange={(e) => set('channelKey', e.target.value)} disabled={!isDraft}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                      <option value="">— seçin —</option>
                      {channels.map((c) => (
                        <option key={c._id} value={c.key}>
                          {c.title}{c.description ? ` — ${c.description}` : ''} ({c.key})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">Şablon</label>
                    <select value={form.templateId} onChange={(e) => set('templateId', e.target.value)} disabled={!isDraft}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                      <option value="">— seçin —</option>
                      {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Konu override (boşsa şablon konusu)</label>
                  <Input value={form.subjectOverride} onChange={(e) => set('subjectOverride', e.target.value)} disabled={!isDraft} />
                </div>

                {/* globalVars */}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Genel değişkenler (herkese aynı)</label>
                  <div className="space-y-2">
                    {vars.map((v, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder="DEGISKEN" value={v.key} disabled={!isDraft}
                          onChange={(e) => setVars((arr) => arr.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                          className="font-mono text-xs" />
                        <Input placeholder="değer" value={v.value} disabled={!isDraft}
                          onChange={(e) => setVars((arr) => arr.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                        {isDraft && <Button variant="ghost" size="sm" onClick={() => setVars((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button>}
                      </div>
                    ))}
                    {isDraft && (
                      <Button variant="outline" size="sm" onClick={() => setVars((arr) => [...arr, { key: '', value: '' }])}>
                        <Plus className="size-3.5" /> Değişken ekle
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gönderim güvenliği */}
            <Card>
              <CardHeader><CardTitle><ShieldCheck className="mr-1 inline size-4" /> Gönderim Güvenliği</CardTitle></CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="w-40">
                    <label className="mb-1 block text-xs text-muted-foreground">Hız (mail/sn)</label>
                    <Input type="number" min={1} value={form.sendConfig.ratePerSec} disabled={!isDraft}
                      onChange={(e) => setSC('ratePerSec', e.target.value)} />
                  </div>
                  <div className="w-44">
                    <label className="mb-1 block text-xs text-muted-foreground">Alıcı limiti (boş=sınırsız)</label>
                    <Input type="number" min={0} value={form.sendConfig.maxRecipients} disabled={!isDraft}
                      onChange={(e) => setSC('maxRecipients', e.target.value)} placeholder="örn. 1000" />
                  </div>
                  <div className="w-40">
                    <label className="mb-1 block text-xs text-muted-foreground">Batch boyutu</label>
                    <Input type="number" min={1} value={form.sendConfig.batchSize} disabled={!isDraft}
                      onChange={(e) => setSC('batchSize', e.target.value)} />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.sendConfig.circuitBreaker.enabled} disabled={!isDraft}
                      onChange={(e) => setCB('enabled', e.target.checked)} />
                    Otomatik fren (oran eşiği aşılırsa kampanyayı durdur)
                  </label>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <div className="w-40">
                      <label className="mb-1 block text-xs text-muted-foreground">Bounce eşiği %</label>
                      <Input type="number" step="0.1" value={form.sendConfig.circuitBreaker.bounceRatePct} disabled={!isDraft || !form.sendConfig.circuitBreaker.enabled}
                        onChange={(e) => setCB('bounceRatePct', e.target.value)} />
                    </div>
                    <div className="w-40">
                      <label className="mb-1 block text-xs text-muted-foreground">Şikayet eşiği %</label>
                      <Input type="number" step="0.01" value={form.sendConfig.circuitBreaker.complaintRatePct} disabled={!isDraft || !form.sendConfig.circuitBreaker.enabled}
                        onChange={(e) => setCB('complaintRatePct', e.target.value)} />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Kötü adresler (bounce/şikayet) otomatik elenir ve tek-tık abonelikten çıkış her maile eklenir — bunlar her zaman açıktır.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sağ: özet + gönder/stats */}
          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardHeader><CardTitle>Özet</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Durum</span>
                <Badge variant="secondary">{status}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Alıcı sayısı</span>
                <span className="font-medium">{form.channelKey ? (recipientCount ?? '…') : '—'}</span>
              </div>
              {estimateMin != null && (
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  ~{estimateMin} dk’da gönderilecek ({form.sendConfig.ratePerSec} mail/sn)
                </div>
              )}

              {campaign?.pausedReason && status === 'paused' && (
                <Alert variant="destructive"><AlertTitle>Duraklatıldı</AlertTitle><AlertDescription>{campaign.pausedReason}</AlertDescription></Alert>
              )}

              {statsData?.stats && (
                <div className="space-y-1 rounded-md border border-border p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Gönderildi</span><span>{statsData.stats.sent}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Başarısız</span><span>{statsData.stats.failed}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Kuyrukta</span><span>{statsData.stats.queued}</span></div>
                </div>
              )}

              {isDraft && !isNew && (
                confirmSend ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      {form.channelKey ? `${recipientCount ?? '?'} kişiye` : ''} gönderilsin mi?
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={doSend} disabled={sending} className="flex-1">
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Evet, gönder
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmSend(false)}>Vazgeç</Button>
                    </div>
                  </div>
                ) : (
                  <Button className="w-full" onClick={() => setConfirmSend(true)} disabled={!form.channelKey || !form.templateId}>
                    <Send className="size-4" /> Gönder
                  </Button>
                )
              )}
              {isNew && <p className="text-xs text-muted-foreground">Önce taslağı kaydedin, sonra gönderebilirsiniz.</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
