'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Loader2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetMailTemplatesQuery, useCreateMailTemplateMutation } from '@/redux/services';

const statusVariant = (s) => (s === 'active' ? 'success' : s === 'archived' ? 'muted' : 'secondary');

export default function CampaignTemplatesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const router = useRouter();

  const { data: templates = [], isLoading, error } = useGetMailTemplatesQuery({}, { skip: !authorized });
  const [createTemplate, { isLoading: creating }] = useCreateMailTemplateMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '' });
  const [notice, setNotice] = useState('');

  const submit = async () => {
    if (!form.name.trim() || !form.subject.trim()) return;
    const r = await createTemplate({ name: form.name, subject: form.subject, bodyHtml: '<p>Merhaba {{USER_NAME}},</p>' })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
    if (r?.__err) return setNotice(r.__err);
    if (r?._id) router.push(`/cms/email/campaign-templates/${r._id}`);
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Kampanya Şablonları"
        description="DB tabanlı dinamik şablonlar ({{USER_NAME}} merge değişkenleri) — dosya .flt'den ayrı"
        actions={
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" /> Yeni Şablon
          </Button>
        }
      />

      {notice && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {showCreate && (
        <Card className="mb-5">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Şablon adı</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Hoş geldin kampanyası" />
            </div>
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Konu</label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Merhaba {{USER_NAME}}, yeniliklerimiz var!" />
            </div>
            <Button onClick={submit} disabled={creating || !form.name.trim() || !form.subject.trim()}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Oluştur &amp; Düzenle
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Şablonlar</CardTitle>
          <CardToolbar><Badge variant="muted">{templates.length}</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription></Alert></div>
          ) : isLoading ? (
            <div className="space-y-1 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : templates.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz şablon yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead>Değişkenler</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell className="font-medium">
                      <Link href={`/cms/email/campaign-templates/${t._id}`} className="text-primary hover:underline">{t.name}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.subject}</TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] text-muted-foreground">{(t.variables || []).join(', ') || '—'}</span>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(t.status)}>{t.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
