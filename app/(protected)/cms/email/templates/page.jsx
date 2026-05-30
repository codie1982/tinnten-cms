'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Save, Loader2, Check, Copy } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { CONTENT_LOCALES } from '@/config/api';
import {
  useGetEmailTemplatesQuery,
  useGetEmailTemplateQuery,
  useSaveEmailTemplateMutation,
  useCreateEmailTemplateMutation,
} from '@/redux/services';

const slugify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

export default function EmailTemplatesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data, isLoading, error } = useGetEmailTemplatesQuery(undefined, { skip: !authorized });
  const templates = data?.items ?? [];

  const [selected, setSelected] = useState(null);
  const [activeLocale, setActiveLocale] = useState('tr');
  const [content, setContent] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: tpl, isFetching } = useGetEmailTemplateQuery(
    { name: selected, locale: activeLocale },
    { skip: !selected || !authorized },
  );
  const [saveTemplate, { isLoading: saving }] = useSaveEmailTemplateMutation();
  const [createTemplate, { isLoading: createBusy }] = useCreateEmailTemplateMutation();

  useEffect(() => {
    if (tpl) setContent(tpl.content || '');
  }, [tpl]);

  const openTemplate = (name) => { setSelected(name); setActiveLocale('tr'); setNotice(''); };

  const handleSave = async () => {
    if (!selected) return;
    const r = await saveTemplate({ name: selected, locale: activeLocale, content }).unwrap().catch(() => null);
    setNotice(r !== null ? 'Şablon kaydedildi.' : '');
  };

  const handleCreate = async () => {
    const name = slugify(newName);
    if (!name) return;
    const r = await createTemplate({ name, locale: 'tr', content: '' }).unwrap().catch(() => null);
    if (r !== null) { setCreating(false); setNewName(''); openTemplate(name); }
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Şablonlar"
        description="Dosya bazlı e-posta şablonları (.flt) — çok dilli düzenleme"
        actions={
          <Button onClick={() => setCreating((v) => !v)}>
            <Plus className="size-4" /> Yeni Şablon
          </Button>
        }
      />

      {creating && (
        <Card className="mb-5">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Şablon adı (dosya: ad.flt)</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="welcome_email" className="font-mono text-sm" />
              {newName && <p className="mt-1 text-[11px] text-muted-foreground">Dosya: <span className="font-mono">{slugify(newName)}.flt</span></p>}
            </div>
            <Button onClick={handleCreate} disabled={createBusy || !slugify(newName)}>
              {createBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Oluştur
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)}>İptal</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Şablon listesi */}
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader>
            <CardTitle>Şablonlar</CardTitle>
            <CardToolbar><Badge variant="muted">{templates.length}</Badge></CardToolbar>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-y-auto p-2">
            {error ? (
              <div className="p-2"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription></Alert></div>
            ) : isLoading ? (
              <div className="space-y-1 p-1">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : (
              <div className="space-y-0.5">
                {templates.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => openTemplate(t.name)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      selected === t.name ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                    )}
                  >
                    <span className={cn('truncate font-mono text-xs', t.isPartial && 'italic text-muted-foreground')}>{t.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{t.localeCount} dil</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editör */}
        <Card>
          <CardHeader>
            <CardTitle>{selected ? <span className="font-mono text-sm">{selected}</span> : 'Bir şablon seçin'}</CardTitle>
            {selected && isFetching && <CardToolbar><Loader2 className="size-4 animate-spin text-muted-foreground" /></CardToolbar>}
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {!selected ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Düzenlemek için soldan bir şablon seçin.</p>
            ) : (
              <>
                {notice && <Alert variant="info"><AlertDescription>{notice}</AlertDescription></Alert>}

                <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
                  {CONTENT_LOCALES.map((l) => {
                    const exists = templates.find((t) => t.name === selected)?.locales?.find((x) => x.code === l.code)?.exists;
                    const active = activeLocale === l.code;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => { setActiveLocale(l.code); setNotice(''); }}
                        className={cn('flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                          active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
                        title={l.name}
                      >
                        <span className="uppercase">{l.code}</span>
                        {exists && <Check className={cn('size-3', active ? 'text-primary-foreground' : 'text-green-600')} />}
                      </button>
                    );
                  })}
                </div>

                {!tpl?.exists && tpl?.fallback && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span>Bu dilde içerik yok. Türkçe içerikten başlayabilirsiniz.</span>
                    <Button size="sm" variant="outline" onClick={() => setContent(tpl.fallback)}>
                      <Copy className="size-3.5" /> TR&apos;den kopyala
                    </Button>
                  </div>
                )}

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={20}
                  spellCheck={false}
                  placeholder="HTML içerik. Değişkenler için {{username}} gibi placeholder kullanın."
                  className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring/30 resize-y"
                />
                <p className="text-[11px] text-muted-foreground">
                  Placeholder örnekleri: <code>{'{{username}}'}</code>, <code>{'{{verification_code}}'}</code> — gönderimde değerlerle değiştirilir. _header/_footer otomatik eklenir.
                </p>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Kaydet ({activeLocale.toUpperCase()})
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
