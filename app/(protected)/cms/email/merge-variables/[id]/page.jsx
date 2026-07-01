'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Save, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetMergeSourcesQuery,
  useGetMergeDefQuery,
  useCreateMergeDefMutation,
  useUpdateMergeDefMutation,
  useDeleteMergeDefMutation,
} from '@/redux/services';

const sanitizeToken = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');

export default function MergeVariableEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: sources = [] } = useGetMergeSourcesQuery(undefined, { skip: !authorized });
  const { data: def, isLoading } = useGetMergeDefQuery(id, { skip: !authorized || isNew });
  const [createDef, { isLoading: creating }] = useCreateMergeDefMutation();
  const [updateDef, { isLoading: saving }] = useUpdateMergeDefMutation();
  const [deleteDef, { isLoading: deleting }] = useDeleteMergeDefMutation();

  const [form, setForm] = useState({
    token: '',
    label: '',
    sourceKey: '',
    fieldKey: '',
    fallback: '',
    description: '',
    status: 'active',
  });
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (def) {
      setForm({
        token: def.token || '',
        label: def.label || '',
        sourceKey: def.sourceKey || '',
        fieldKey: def.fieldKey || '',
        fallback: def.fallback || '',
        description: def.description || '',
        status: def.status || 'active',
      });
    }
  }, [def]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fieldOptions = useMemo(
    () => sources.find((s) => s.sourceKey === form.sourceKey)?.fields ?? [],
    [sources, form.sourceKey],
  );
  const selectedField = fieldOptions.find((f) => f.fieldKey === form.fieldKey);

  const onSourceChange = (sourceKey) => {
    setForm((f) => {
      const fields = sources.find((s) => s.sourceKey === sourceKey)?.fields ?? [];
      const fieldKey = fields.some((x) => x.fieldKey === f.fieldKey)
        ? f.fieldKey
        : fields[0]?.fieldKey || '';
      return { ...f, sourceKey, fieldKey };
    });
  };

  const buildPayload = () => ({
    token: sanitizeToken(form.token),
    label: form.label.trim(),
    sourceKey: form.sourceKey,
    fieldKey: form.fieldKey,
    fallback: form.fallback,
    description: form.description.trim(),
    status: form.status,
  });

  const save = async () => {
    const p = buildPayload();
    if (!p.token || !p.label || !p.sourceKey || !p.fieldKey) {
      return setNotice('Token, etiket, kaynak ve alan zorunlu.');
    }
    if (isNew) {
      const r = await createDef(p)
        .unwrap()
        .catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
      if (r?.__err) return setNotice(r.__err);
      if (r?._id) router.push(`/cms/email/merge-variables/${r._id}`);
    } else {
      const r = await updateDef({ id, ...p })
        .unwrap()
        .catch((e) => ({ __err: e?.data?.message || 'Kaydedilemedi' }));
      setNotice(r?.__err || 'Değişken kaydedildi.');
    }
  };

  const remove = async () => {
    const r = await deleteDef(id)
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Silinemedi' }));
    if (r?.__err) return setNotice(r.__err);
    router.push('/cms/email/merge-variables');
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email · Değişken"
        title={isNew ? 'Yeni Değişken' : form.token ? `{{${form.token}}}` : 'Değişken'}
        description="Token'ı güvenli bir DB kaynağına bağlayın — değer gönderimde alıcı bazında çözülür"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/cms/email/merge-variables">
              <Button variant="outline">
                <ArrowLeft className="size-4" /> Liste
              </Button>
            </Link>
            <Button onClick={save} disabled={creating || saving}>
              {creating || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Kaydet
            </Button>
            {!isNew &&
              (confirmDelete ? (
                <Button variant="destructive" onClick={remove} disabled={deleting}>
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Emin?
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" /> Sil
                </Button>
              ))}
          </div>
        }
      />

      {notice && (
        <Alert variant="info" className="mb-4">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {!isNew && isLoading ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Token</label>
                <Input
                  value={form.token}
                  onChange={(e) => set('token', sanitizeToken(e.target.value))}
                  placeholder="USER_COMPANY_NAME"
                  className="font-mono"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Şablonda <span className="font-mono">{`{{${form.token || 'TOKEN'}}}`}</span> olarak kullanın.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Etiket</label>
                <Input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="Firma adı" />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Kaynak</label>
                  <select
                    value={form.sourceKey}
                    onChange={(e) => onSourceChange(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">— seçin —</option>
                    {sources.map((s) => (
                      <option key={s.sourceKey} value={s.sourceKey}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Alan</label>
                  <select
                    value={form.fieldKey}
                    onChange={(e) => set('fieldKey', e.target.value)}
                    disabled={!form.sourceKey}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                  >
                    <option value="">— seçin —</option>
                    {fieldOptions.map((f) => (
                      <option key={f.fieldKey} value={f.fieldKey}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Fallback (değer boşsa)</label>
                <Input
                  value={form.fallback}
                  onChange={(e) => set('fallback', e.target.value)}
                  placeholder="örn. değerli müşterimiz"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="w-40">
                  <label className="mb-1 block text-xs text-muted-foreground">Durum</label>
                  <select
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="active">Aktif</option>
                    <option value="archived">Arşiv</option>
                  </select>
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Açıklama (opsiyonel)</label>
                  <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardHeader>
              <CardTitle>Önizleme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Token</span>
                <span className="font-mono">{`{{${form.token || 'TOKEN'}}}`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Kaynak</span>
                <span className="font-mono text-xs">
                  {form.sourceKey && form.fieldKey ? `${form.sourceKey}.${form.fieldKey}` : '—'}
                </span>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">Örnek render</div>
                <div className="mt-1">{selectedField?.sample || form.fallback || '—'}</div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Değer gönderimde her alıcı için DB'den okunur; boşsa fallback kullanılır. Kaydedince şablon
                editöründe “Değişken ekle” butonu olarak çıkar.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
