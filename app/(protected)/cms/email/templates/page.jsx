'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Eye, X, Save, LayoutTemplate } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { SplitShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';

/* ─── mock ─── */
const templatesMock = [
  {
    id: 'tpl-1',
    name: 'Hoşgeldin Emaili',
    subject: 'Tinnten\'e hoş geldiniz, {{name}}!',
    category: 'onboarding',
    status: 'active',
    updatedAt: '20.05.2025',
    htmlPreview: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 16px">Hoşgeldiniz, {{name}}! 👋</h1>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px">
    Tinnten B2B platformuna kaydolduğunuz için teşekkür ederiz. Hesabınız başarıyla oluşturuldu.
  </p>
  <a href="{{login_url}}" style="display:inline-block;background:#6366F1;color:#fff;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none">
    Platforma Giriş Yap →
  </a>
  <p style="font-size:12px;color:#9CA3AF;margin:32px 0 0">© 2025 Tinnten A.Ş. — Tüm hakları saklıdır.</p>
</div>`,
  },
  {
    id: 'tpl-2',
    name: 'KYC Onay Bildirimi',
    subject: 'Firma doğrulamanız tamamlandı ✓',
    category: 'kyc',
    status: 'active',
    updatedAt: '18.05.2025',
    htmlPreview: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
    <span style="font-size:28px">✅</span>
    <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0">Firma Doğrulamanız Onaylandı</h1>
  </div>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px">
    <strong>{{company_name}}</strong> adlı firma hesabınız başarıyla doğrulandı. Artık tüm platform özelliklerine erişebilirsiniz.
  </p>
  <a href="{{dashboard_url}}" style="display:inline-block;background:#10b981;color:#fff;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none">
    Panele Git →
  </a>
</div>`,
  },
  {
    id: 'tpl-3',
    name: 'Fatura Bildirim',
    subject: '{{period}} dönemi faturanız hazır',
    category: 'billing',
    status: 'active',
    updatedAt: '15.05.2025',
    htmlPreview: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">Faturanız Hazır</h1>
  <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
    <tr style="border-bottom:1px solid #E5E7EB">
      <td style="padding:10px 0;color:#6B7280;font-size:14px">Dönem</td>
      <td style="padding:10px 0;font-size:14px;font-weight:600;text-align:right">{{period}}</td>
    </tr>
    <tr style="border-bottom:1px solid #E5E7EB">
      <td style="padding:10px 0;color:#6B7280;font-size:14px">Fatura No</td>
      <td style="padding:10px 0;font-size:14px;text-align:right">{{invoice_no}}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;font-weight:700">Toplam Tutar</td>
      <td style="padding:10px 0;font-weight:700;color:#6366F1;text-align:right">{{amount}} ₺</td>
    </tr>
  </table>
  <a href="{{invoice_url}}" style="display:inline-block;background:#6366F1;color:#fff;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none">
    Faturayı İndir
  </a>
</div>`,
  },
  {
    id: 'tpl-4',
    name: 'KYC Hatırlatması',
    subject: 'Firma doğrulamanızı tamamlayın — {{days_left}} gün kaldı',
    category: 'kyc',
    status: 'active',
    updatedAt: '10.05.2025',
    htmlPreview: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:16px;margin-bottom:20px">
    <p style="font-size:14px;color:#92400E;margin:0;font-weight:600">⚠️ KYC sürecinizi tamamlamanız gerekiyor</p>
  </div>
  <p style="font-size:15px;color:#374151;line-height:1.6">
    Firma hesabınızın tam erişim için <strong>{{days_left}} gün</strong> içinde doğrulamanızı tamamlamanız gerekmektedir.
  </p>
  <a href="{{kyc_url}}" style="display:inline-block;background:#F59E0B;color:#fff;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none">
    Doğrulamayı Tamamla →
  </a>
</div>`,
  },
  {
    id: 'tpl-5',
    name: 'Kampanya Duyurusu',
    subject: '🎉 {{campaign_name}} — Kaçırmayın!',
    category: 'marketing',
    status: 'draft',
    updatedAt: '08.05.2025',
    htmlPreview: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:0">
  <div style="background:linear-gradient(135deg,#6366F1,#8B5CF6);padding:40px 24px;text-align:center">
    <h1 style="font-size:26px;font-weight:800;color:#fff;margin:0">{{campaign_name}}</h1>
    <p style="font-size:16px;color:rgba(255,255,255,0.9);margin:12px 0 0">{{campaign_subtitle}}</p>
  </div>
  <div style="padding:32px 24px">
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px">{{campaign_body}}</p>
    <a href="{{cta_url}}" style="display:inline-block;background:#6366F1;color:#fff;font-size:15px;font-weight:700;padding:12px 32px;border-radius:10px;text-decoration:none">
      {{cta_label}} →
    </a>
  </div>
</div>`,
  },
  {
    id: 'tpl-6',
    name: 'Şifre Sıfırlama',
    subject: 'Şifrenizi sıfırlayın',
    category: 'security',
    status: 'active',
    updatedAt: '01.05.2025',
    htmlPreview: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">Şifre Sıfırlama İsteği</h1>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 8px">
    Hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki bağlantı <strong>15 dakika</strong> geçerlidir.
  </p>
  <a href="{{reset_url}}" style="display:inline-block;background:#6366F1;color:#fff;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none;margin:16px 0">
    Şifremi Sıfırla
  </a>
  <p style="font-size:12px;color:#9CA3AF">Bu isteği siz yapmadıysanız bu emaili yok sayabilirsiniz.</p>
</div>`,
  },
];

const categoryMeta = {
  onboarding: { label: 'Onboarding', variant: 'primary' },
  kyc: { label: 'KYC', variant: 'warning' },
  billing: { label: 'Fatura', variant: 'secondary' },
  marketing: { label: 'Kampanya', variant: 'success' },
  security: { label: 'Güvenlik', variant: 'destructive' },
};

const statusMeta = {
  active: { label: 'Aktif', variant: 'success' },
  draft: { label: 'Taslak', variant: 'warning' },
  archived: { label: 'Arşiv', variant: 'muted' },
};

/* ─── page ─── */
export default function MailTemplatesPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState(templatesMock[0]);
  const [editMode, setEditMode] = useState(false);
  const [editHtml, setEditHtml] = useState(templatesMock[0]?.htmlPreview ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(t);
  }, [search, categoryFilter, statusFilter]);

  const filtered = useMemo(() =>
    templatesMock
      .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => !search || [t.name, t.subject].some((f) => f.toLowerCase().includes(search.toLowerCase()))),
    [search, categoryFilter, statusFilter],
  );

  function handleSelect(tpl) {
    setSelected(tpl);
    setEditHtml(tpl.htmlPreview);
    setEditMode(false);
  }

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setEditMode(false);
      setSaving(false);
    }, 600);
  }

  const aside = (
    <div className="sticky top-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">{selected?.name ?? 'Şablon Seçin'}</CardTitle>
              {selected && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{selected.subject}</p>}
            </div>
            {selected && (
              <div className="flex shrink-0 gap-1">
                {editMode ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}><X className="size-3.5" /></Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}><Save className="size-3.5" />{saving ? '…' : 'Kaydet'}</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                    <Pencil className="size-3.5" />
                    Düzenle
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selected ? (
            editMode ? (
              <textarea
                value={editHtml}
                onChange={(e) => setEditHtml(e.target.value)}
                rows={20}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30 resize-y"
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-white">
                <div className="max-h-[400px] overflow-y-auto">
                  <iframe
                    srcDoc={selected.htmlPreview}
                    title="Şablon önizleme"
                    className="w-full"
                    style={{ height: '380px', border: 'none' }}
                  />
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <LayoutTemplate className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Önizlemek için şablon seçin</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Email Şablonları"
        description="Yeniden kullanılabilir email şablonlarını oluşturun, düzenleyin ve yönetin"
        actions={
          <Button>
            <Plus className="size-4" />
            Yeni Şablon
          </Button>
        }
      />

      <SplitShell aside={aside} asideWidth="w-96">
        {/* Toolbar */}
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Şablon adı veya konu ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
              />
            </div>
            <div className="w-36">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Kategoriler</SelectItem>
                  {Object.entries(categoryMeta).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="draft">Taslak</SelectItem>
                  <SelectItem value="archived">Arşiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Şablon Listesi</CardTitle>
            <CardToolbar>
              <Badge variant="muted">{filtered.length} şablon</Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Şablon Adı</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Güncelleme</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tpl) => (
                    <TableRow
                      key={tpl.id}
                      className={cn('cursor-pointer', selected?.id === tpl.id && 'bg-primary/5')}
                      onClick={() => handleSelect(tpl)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{tpl.name}</span>
                          <span className="text-xs text-muted-foreground line-clamp-1">{tpl.subject}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={categoryMeta[tpl.category]?.variant}>
                          {categoryMeta[tpl.category]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusMeta[tpl.status]?.variant}>
                          {statusMeta[tpl.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{tpl.updatedAt}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="size-7 hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </SplitShell>
    </RoleGuard>
  );
}
