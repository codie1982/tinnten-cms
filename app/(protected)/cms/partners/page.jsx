'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FileCheck2, Handshake, Package } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import PartnerApplicationsPage from './applications/page';
import CompanyPartnerRelationsPage from './relations/page';
import PartnerServicesPage from './services/page';

const DEFAULT_TAB = 'applications';

function PartnerWorkspace() {
  const { data: session } = useSession();
  const roles = session?.roles ?? [];
  const isAdmin = canAccess(roles, [CMS_ROLES.ADMIN]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const availableTabs = isAdmin
    ? ['applications', 'relations', 'services']
    : ['applications'];
  const requestedTab = searchParams.get('tab');
  const activeTab = availableTabs.includes(requestedTab) ? requestedTab : DEFAULT_TAB;

  const setActiveTab = (tab) => {
    router.replace(tab === DEFAULT_TAB ? pathname : `${pathname}?tab=${tab}`, { scroll: false });
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Partnerler"
        title="Partner Yönetimi"
        description="Ön başvuruları, firma ilişkilerini, hizmet paketlerini ve anlaşmaları tek çalışma alanından yönetin."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <Card>
          <CardContent className="p-0">
            <TabsList className="border-b-0 px-2 pt-1">
              <TabsTrigger value="applications">
                <FileCheck2 className="me-2 size-4" /> Başvurular
              </TabsTrigger>
              {isAdmin ? (
                <TabsTrigger value="relations">
                  <Handshake className="me-2 size-4" /> İlişkiler
                </TabsTrigger>
              ) : null}
              {isAdmin ? (
                <TabsTrigger value="services">
                  <Package className="me-2 size-4" /> Hizmetler
                </TabsTrigger>
              ) : null}
            </TabsList>
          </CardContent>
        </Card>

        <TabsContent value="applications">
          <PartnerApplicationsPage embedded />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="relations">
            <CompanyPartnerRelationsPage embedded />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="services">
            <PartnerServicesPage embedded />
          </TabsContent>
        ) : null}
      </Tabs>
    </RoleGuard>
  );
}

function PartnerWorkspaceSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export default function PartnersPage() {
  return (
    <Suspense fallback={<PartnerWorkspaceSkeleton />}>
      <PartnerWorkspace />
    </Suspense>
  );
}
