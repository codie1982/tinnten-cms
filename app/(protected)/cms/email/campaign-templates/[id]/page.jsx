'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Save, Loader2, ArrowLeft, Eye } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MailTemplateEditor } from '@/components/cms/mail-template-editor';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { CONTENT_LOCALES } from '@/config/api';
import {
  useGetMailTemplateQuery,
  useUpdateMailTemplateMutation,
  usePreviewMailTemplateMutation,
  useGetMergeVariablesQuery,
} from '@/redux/services';

const STATUSES = [
  { value: 'draft', label: 'Taslak' },
  { value: 'active', label: 'Aktif' },
  { value: 'archived', label: 'Arşiv' },
];

export default function CampaignTemplateEditPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: tpl, isLoading } = useGetMailTemplateQuery(id, { skip: !authorized || !id });
  const { data: variables = [] } = useGetMergeVariablesQuery(undefined, { skip: !authorized });
  const [updateTemplate, { isLoading: saving }] = useUpdateMailTemplateMutation();
  const [previewTemplate, { isLoading: previewing }] = usePreviewMailTemplateMutation();

  const [form, setForm] = useState({ name: '', subject: '', bodyHtml: '', locale: 'tr', status: 'draft' });
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (tpl) {
      setForm({
        name: tpl.name || '',
        subject: tpl.subject || '',
        bodyHtml: tpl.bodyHtml || '',
        locale: tpl.locale || 'tr',
        status: tpl.status || 'draft',
      });
    }
  }, [tpl]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const r = await updateTemplate({ id, ...form }).unwrap().catch((e) => ({ __err: e?.data?.message || 'Kaydedilemedi' }));
    setNotice(r?.__err || 'Şablon kaydedildi.');
  };

  const doPreview = async () => {
    const r = await previewTemplate({ id, sampleVars: {} }).unwrap().catch(() => null);
    if (r) setPreview(r);
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email · Şablon"
        title={form.name || 'Şablon'}
        description="Gövdeye {{USER_NAME}} gibi değişkenleri editör üstündeki butonlarla ekleyin"
        actions={
          <div className="flex gap-2">
            <Link href="/cms/email/campaign-templates"><Button variant="outline"><ArrowLeft className="size-4" /> Liste</Button></Link>
            <Button variant="outline" onClick={doPreview} disabled={previewing}>
              {previewing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Önizle
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Kaydet
            </Button>
          </div>
        }
      />

      {notice && <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Şablon adı</label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Konu (değişken içerebilir)</label>
                  <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <div className="w-40">
                    <label className="mb-1 block text-xs text-muted-foreground">Dil</label>
                    <select value={form.locale} onChange={(e) => set('locale', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                      {CONTENT_LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="w-40">
                    <label className="mb-1 block text-xs text-muted-foreground">Durum</label>
                    <select value={form.status} onChange={(e) => set('status', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Gövde</label>
                  <MailTemplateEditor value={form.bodyHtml} onChange={(html) => set('bodyHtml', html)} variables={variables} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Unsubscribe linki gönderimde otomatik eklenir. Değişkenler {`{{USER_NAME}}`} gibi düz metin olarak saklanır.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Önizleme */}
          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardHeader><CardTitle>Önizleme</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4">
              {tpl?.variables?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tpl.variables.map((v) => <Badge key={v} variant="secondary" className="font-mono text-[10px]">{`{{${v}}}`}</Badge>)}
                </div>
              )}
              {preview ? (
                <>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Konu:</span> {preview.subject}</div>
                  <div className="rounded-md border border-border p-3 text-sm" dangerouslySetInnerHTML={{ __html: preview.html }} />
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Önizlemek için “Önizle”ye basın (örnek değerlerle render edilir).</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
