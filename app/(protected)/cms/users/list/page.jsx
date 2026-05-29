'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CMS_ROLES } from '@/lib/roles';
import { usersMock, statusMeta, roleMeta, statusOptions } from '../_data';

/* ─── page ─── */
export default function CmsUsersListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  const filtered = useMemo(
    () =>
      usersMock
        .filter((u) => statusFilter === 'all' || u.status === statusFilter)
        .filter((u) =>
          search
            ? [u.name, u.email].some((f) =>
                f.toLowerCase().includes(search.toLowerCase()),
              )
            : true,
        ),
    [search, statusFilter],
  );

  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Kullanıcılar"
        title="Tüm Kullanıcılar"
        description="CMS kullanıcılarını ve rollerini yönetin"
        actions={
          <Button>
            <Plus className="size-4" />
            Kullanıcı Ekle
          </Button>
        }
      />

      {/* Toolbar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="İsim veya e-posta ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          <div className="w-44">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{filtered.length} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Search className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Kullanıcı bulunamadı</p>
              <p className="text-sm text-muted-foreground">
                Filtreleri değiştirerek yeniden deneyin.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
              >
                Filtreleri sıfırla
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>Roller</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const s = statusMeta[u.status];
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={u.name} size="md" />
                            <div>
                              <Link
                                href={`/cms/users/${u.id}`}
                                className="text-sm font-medium text-foreground hover:text-primary"
                              >
                                {u.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <Badge
                                key={r}
                                variant={roleMeta[r]?.variant ?? 'muted'}
                              >
                                {roleMeta[r]?.label ?? r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={s?.variant}>{s?.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
