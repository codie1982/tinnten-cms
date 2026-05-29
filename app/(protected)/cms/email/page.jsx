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

const campaigns = [
  { id: 'EM-88', name: 'Haftalık Bülten #21', segment: 'Tüm Kullanıcılar', sent: 12480, open: '42%', status: 'sent' },
  { id: 'EM-89', name: 'Yeni Asistan Duyurusu', segment: 'Profesyonel', sent: 980, open: '57%', status: 'sent' },
  { id: 'EM-90', name: 'Onboarding Serisi 1', segment: 'Yeni Kayıtlar', sent: 0, open: '—', status: 'scheduled' },
  { id: 'EM-91', name: 'Kampanya Taslağı', segment: '—', sent: 0, open: '—', status: 'draft' },
];

const statusMeta = {
  sent: { label: 'Gönderildi', variant: 'success' },
  scheduled: { label: 'Zamanlandı', variant: 'primary' },
  draft: { label: 'Taslak', variant: 'muted' },
};

export default function EmailPage() {
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="İçerik"
        title="Email"
        description="Email kampanyalarını oluşturun ve takip edin"
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Yeni Kampanya
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Kampanyalar</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{campaigns.length} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kampanya</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Gönderim</TableHead>
                <TableHead>Açılma</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const s = statusMeta[c.status];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.segment}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.sent.toLocaleString('tr-TR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.open}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
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
