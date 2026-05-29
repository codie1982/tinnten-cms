'use client';

import { useState } from 'react';
import {
  Plus,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  X,
  Save,
  Mail,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';

/* ─── mock ─── */
const listsMock = [
  {
    id: 'ml-1',
    name: 'Tüm Alıcılar',
    description: 'Platforma kayıtlı tüm kullanıcılar',
    subscriberCount: 14823,
    trend: +341,
    status: 'active',
    updatedAt: '29.05.2025',
    weeklyData: [120, 145, 132, 158, 167, 142, 180],
  },
  {
    id: 'ml-2',
    name: 'Aktif Satıcılar',
    description: 'Son 30 günde aktif olan satıcı hesapları',
    subscriberCount: 3241,
    trend: +87,
    status: 'active',
    updatedAt: '28.05.2025',
    weeklyData: [30, 38, 35, 42, 40, 37, 45],
  },
  {
    id: 'ml-3',
    name: 'Pro Üyeler',
    description: 'Pro veya Enterprise üyelik paketi olan hesaplar',
    subscriberCount: 1087,
    trend: +23,
    status: 'active',
    updatedAt: '27.05.2025',
    weeklyData: [8, 12, 9, 14, 11, 13, 16],
  },
  {
    id: 'ml-4',
    name: 'Onay Bekleyenler',
    description: 'KYC başvurusu tamamlanmamış veya beklemede olan firmalar',
    subscriberCount: 428,
    trend: -12,
    status: 'active',
    updatedAt: '29.05.2025',
    weeklyData: [42, 38, 45, 36, 40, 34, 38],
  },
  {
    id: 'ml-5',
    name: 'Yeni Kayıtlar',
    description: 'Son 7 günde kaydolan kullanıcılar',
    subscriberCount: 186,
    trend: +31,
    status: 'active',
    updatedAt: '29.05.2025',
    weeklyData: [20, 28, 24, 32, 28, 35, 31],
  },
  {
    id: 'ml-6',
    name: 'Pasif Kullanıcılar',
    description: '90+ gündür giriş yapmamış hesaplar (yeniden aktivasyon kampanyaları için)',
    subscriberCount: 2943,
    trend: -56,
    status: 'passive',
    updatedAt: '15.05.2025',
    weeklyData: [60, 55, 58, 52, 50, 48, 46],
  },
];

/* ─── Mini Sparkline ─── */
function Sparkline({ data, trend }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const color = trend >= 0 ? '#10b981' : '#ef4444';
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/* ─── List Card ─── */
function ListCard({ list, onEdit }) {
  const [active, setActive] = useState(list.status === 'active');
  const TrendIcon = list.trend > 0 ? TrendingUp : list.trend < 0 ? TrendingDown : Minus;
  const trendColor = list.trend > 0 ? 'text-emerald-600' : list.trend < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card className={cn('transition-opacity', !active && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-4" />
            </div>
            <CardTitle className="truncate">{list.name}</CardTitle>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setActive((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={active ? 'Pasife al' : 'Aktif et'}
            >
              {active
                ? <ToggleRight className="size-5 text-primary" />
                : <ToggleLeft className="size-5" />}
            </button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit(list)}>
              <Pencil className="size-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tabular-nums leading-none">{list.subscriberCount.toLocaleString('tr-TR')}</p>
            <div className={cn('mt-1 flex items-center gap-1 text-xs', trendColor)}>
              <TrendIcon className="size-3" />
              <span>{list.trend > 0 ? '+' : ''}{list.trend} bu hafta</span>
            </div>
          </div>
          <Sparkline data={list.weeklyData} trend={list.trend} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Güncellendi: {list.updatedAt}</p>
      </CardContent>
    </Card>
  );
}

/* ─── page ─── */
export default function MailListsPage() {
  const [lists, setLists] = useState(listsMock);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  function startCreate() {
    setEditTarget(null);
    setForm({ name: '', description: '' });
    setShowForm(true);
  }

  function startEdit(list) {
    setEditTarget(list);
    setForm({ name: list.name, description: list.description });
    setShowForm(true);
  }

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      if (editTarget) {
        setLists((ls) => ls.map((l) => l.id === editTarget.id ? { ...l, ...form } : l));
      } else {
        setLists((ls) => [...ls, {
          id: `ml-${Date.now()}`,
          ...form,
          subscriberCount: 0,
          trend: 0,
          status: 'active',
          updatedAt: new Date().toLocaleDateString('tr-TR'),
          weeklyData: [0, 0, 0, 0, 0, 0, 0],
        }]);
      }
      setSaving(false);
      setShowForm(false);
      setEditTarget(null);
    }, 600);
  }

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Mail Listeleri"
        description="Kampanya segmentlerini ve abone listelerini yönetin"
        actions={
          <Button onClick={startCreate}>
            <Plus className="size-4" />
            Yeni Liste
          </Button>
        }
      />

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="mb-5 border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{editTarget ? 'Listeyi Düzenle' : 'Yeni Liste Oluştur'}</p>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setShowForm(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Liste Adı *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="örn. VIP Satıcılar"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Açıklama</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Liste hakkında kısa açıklama"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>İptal</Button>
              <Button size="sm" disabled={!form.name || saving} onClick={handleSave}>
                <Save className="size-3.5" />
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats summary */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2sm text-muted-foreground">Toplam Liste</p>
            <p className="mt-1 text-2xl font-bold">{lists.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2sm text-muted-foreground">Toplam Abone</p>
            <p className="mt-1 text-2xl font-bold">
              {lists.reduce((s, l) => s + l.subscriberCount, 0).toLocaleString('tr-TR')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2sm text-muted-foreground">Aktif Listeler</p>
            <p className="mt-1 text-2xl font-bold">{lists.filter((l) => l.status === 'active').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} onEdit={startEdit} />
        ))}
      </div>
    </RoleGuard>
  );
}
