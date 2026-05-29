import { Plus } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CMS_ROLES } from '@/lib/roles';

const contents = [
  { id: 'C-301', title: 'Ana Sayfa Hero Metni', type: 'Sayfa', author: 'Ayşe Demir', status: 'published', updated: '2026-05-28' },
  { id: 'C-302', title: 'Satıcı Akademisi: Başlangıç', type: 'Makale', author: 'Mehmet Kaya', status: 'draft', updated: '2026-05-27' },
  { id: 'C-303', title: 'SSS — Ödemeler', type: 'SSS', author: 'Zeynep Ak', status: 'review', updated: '2026-05-26' },
  { id: 'C-304', title: 'Gizlilik Politikası', type: 'Sözleşme', author: 'Ayşe Demir', status: 'published', updated: '2026-05-20' },
];

const statusMeta = {
  published: { label: 'Yayında', variant: 'success' },
  draft: { label: 'Taslak', variant: 'muted' },
  review: { label: 'İncelemede', variant: 'warning' },
};

export default function ContentPage() {
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="İçerik"
        title="İçerikler"
        description="İçerik oluşturun, düzenleyin ve yayınlayın"
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Yeni İçerik
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>İçerik Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{contents.length} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başlık</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Yazar</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Güncelleme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contents.map((c) => {
                const s = statusMeta[c.status];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.author}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.updated}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
