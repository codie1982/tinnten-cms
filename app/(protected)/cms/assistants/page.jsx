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

const assistants = [
  { id: 'AS-1042', name: 'Satış Asistanı', owner: 'Tinnten A.Ş.', model: 'gpt-4o', status: 'active' },
  { id: 'AS-1043', name: 'Destek Botu', owner: 'Acme Ltd.', model: 'claude-sonnet', status: 'active' },
  { id: 'AS-1044', name: 'Onboarding', owner: 'Globex', model: 'gpt-4o-mini', status: 'paused' },
  { id: 'AS-1045', name: 'SSS Asistanı', owner: 'Tinnten A.Ş.', model: 'claude-haiku', status: 'draft' },
  { id: 'AS-1046', name: 'Lead Toplama', owner: 'Initech', model: 'gpt-4o', status: 'active' },
];

const statusMeta = {
  active: { label: 'Aktif', variant: 'success' },
  paused: { label: 'Duraklatıldı', variant: 'warning' },
  draft: { label: 'Taslak', variant: 'muted' },
};

export default function AssistantsPage() {
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
      <PageHeader
        section="Yapay Zeka"
        title="Tüm Asistanlar"
        description="Tüm AI asistanlarını görüntüleyin ve yönetin"
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Yeni Asistan
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Asistan Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{assistants.length} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Asistan</TableHead>
                <TableHead>Sahip</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assistants.map((a) => {
                const s = statusMeta[a.status];
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {a.id}
                    </TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.owner}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.model}
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
