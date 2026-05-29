'use client';

import { useState } from 'react';
import { Plus, Eye, Pencil, Archive, CheckCircle2, Clock, FileSignature, X, Save } from 'lucide-react';
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
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';

const versionStatusMeta = {
  active: { label: 'Aktif', variant: 'success', icon: CheckCircle2 },
  draft: { label: 'Taslak', variant: 'warning', icon: Clock },
  archived: { label: 'Arşivlendi', variant: 'muted', icon: Archive },
};

const TEMPLATE_CONTENT = `Bu sözleşme, Tinnten platformunu kullanan taraflar arasındaki hak ve yükümlülükleri düzenlemektedir.

1. TARAFLAR
İşbu sözleşme, bir tarafta platform hizmetlerini sunan Tinnten A.Ş. (bundan böyle "Platform" olarak anılacaktır), diğer tarafta ilgili hizmetleri kullanan satıcı/kullanıcı (bundan böyle "Kullanıcı" olarak anılacaktır) arasında akdedilmiştir.

2. HİZMETİN KAPSAMI
Platform, B2B ticaret ekosistemi kapsamında alıcı-satıcı eşleştirme, sipariş yönetimi, ödeme güvencesi ve yapay zeka destekli analitik hizmetleri sunmaktadır.

3. YÜKÜMLÜLÜKLER
Kullanıcı, platformu hukuka uygun şekilde kullanmayı, yanlış veya yanıltıcı bilgi vermemeyi ve üçüncü tarafların haklarını ihlal etmemeyi kabul eder.

4. GİZLİLİK
Taraflara ait ticari sırlar ve kişisel veriler, KVKK ve GDPR kapsamında korunmakta olup üçüncü şahıslarla paylaşılmaz.

5. UYUŞMAZLIK ÇÖZÜMÜ
İşbu sözleşmeden doğacak uyuşmazlıklar, öncelikle müzakere yoluyla çözülmeye çalışılır; aksi takdirde İstanbul Mahkemeleri yetkilidir.`;

/**
 * Ortak sözleşme şablonu sayfası.
 * section, title, description, mockVersions props alır.
 */
export function ContractTemplatesPage({ section, title, description, mockVersions }) {
  const [versions, setVersions] = useState(mockVersions);
  const [selected, setSelected] = useState(mockVersions[0]);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(mockVersions[0]?.content ?? '');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newVersionContent, setNewVersionContent] = useState('');
  const [saving, setSaving] = useState(false);

  function handleSelect(v) {
    setSelected(v);
    setEditContent(v.content);
    setEditMode(false);
  }

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setVersions((vs) => vs.map((v) => (v.id === selected.id ? { ...v, content: editContent } : v)));
      setEditMode(false);
      setSaving(false);
    }, 600);
  }

  function handleAddVersion() {
    const next = {
      id: `v-${Date.now()}`,
      version: `v${versions.length + 1}.0`,
      publishedAt: null,
      status: 'draft',
      updatedBy: 'Editör',
      content: newVersionContent || TEMPLATE_CONTENT,
    };
    setVersions((vs) => [next, ...vs]);
    setSelected(next);
    setEditContent(next.content);
    setNewVersionContent('');
    setShowNewForm(false);
  }

  const aside = (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle>İçerik Önizleme</CardTitle>
        <CardToolbar>
          {!editMode ? (
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
              <Pencil className="size-3.5" />
              Düzenle
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                <X className="size-3.5" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="size-3.5" />
                {saving ? '…' : 'Kaydet'}
              </Button>
            </div>
          )}
        </CardToolbar>
      </CardHeader>
      <CardContent>
        {selected ? (
          editMode ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={24}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30 resize-y"
            />
          ) : (
            <div className="max-h-[500px] overflow-y-auto rounded-lg border border-border bg-muted/30 px-4 py-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
              {selected.content}
            </div>
          )
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Sürüm seçin</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section={section}
        title={title}
        description={description}
        actions={
          <Button onClick={() => setShowNewForm((v) => !v)}>
            <Plus className="size-4" />
            Yeni Sürüm
          </Button>
        }
      />

      {/* New version quick form */}
      {showNewForm && (
        <Card className="mb-5 border-primary/30 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">Yeni Taslak Sürüm</p>
            <textarea
              value={newVersionContent}
              onChange={(e) => setNewVersionContent(e.target.value)}
              rows={4}
              placeholder="Sözleşme içeriğini buraya yapıştırın (boş bırakırsanız varsayılan şablon kullanılır)…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>İptal</Button>
              <Button size="sm" onClick={handleAddVersion}>Taslak Oluştur</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <SplitShell aside={aside} asideWidth="w-96">
        <Card>
          <CardHeader>
            <CardTitle>Sürüm Geçmişi</CardTitle>
            <CardToolbar>
              <Badge variant="muted">{versions.length} sürüm</Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sürüm</TableHead>
                  <TableHead>Yayın Tarihi</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Güncelleyen</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => {
                  const sm = versionStatusMeta[v.status];
                  const isActive = v.status === 'active';
                  const isSelected = selected?.id === v.id;
                  return (
                    <TableRow
                      key={v.id}
                      className={cn(
                        'cursor-pointer',
                        isActive && 'border-l-2 border-primary bg-primary/5',
                        isSelected && !isActive && 'bg-accent/60',
                      )}
                      onClick={() => handleSelect(v)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSignature className="size-4 shrink-0 text-muted-foreground" />
                          <span className="font-mono font-medium">{v.version}</span>
                          {isActive && <Badge variant="success" className="text-xs">Aktif</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {v.publishedAt ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sm?.variant}>{sm?.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.updatedBy}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={(e) => { e.stopPropagation(); handleSelect(v); setEditMode(true); }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </SplitShell>
    </RoleGuard>
  );
}
