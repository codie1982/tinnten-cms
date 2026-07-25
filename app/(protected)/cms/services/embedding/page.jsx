'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Activity, Building2, FileStack, Search } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import CompaniesSection from './CompaniesSection';
import DocumentsSection from './DocumentsSection';
import SearchSection from './SearchSection';
import StatusSection from './StatusSection';

const SECTIONS = [
  { key: 'status', label: 'Genel Durum', icon: Activity, desc: 'Servis sağlığı & istatistik' },
  { key: 'companies', label: 'Firma İndeksleri', icon: Building2, desc: 'Şirket bazlı indeks & drift' },
  { key: 'documents', label: 'Dokümanlar', icon: FileStack, desc: 'İndekslenen içerikler' },
  { key: 'search', label: 'Arama Testi', icon: Search, desc: 'Semantik vektör arama' },
];

export default function EmbeddingServicePage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [section, setSection] = useState('status');

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Servisler"
        title="Embedding Servisi"
        description="tinnten-embedding: servis sağlığı, firma indeksleri, dokümanlar ve semantik arama"
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const active = section === sec.key;
                return (
                  <button key={sec.key} onClick={() => setSection(sec.key)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}>
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{sec.label}</span>
                      <span className="block text-xs text-muted-foreground">{sec.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        <div>
          {section === 'status' && <StatusSection authorized={authorized} />}
          {section === 'companies' && <CompaniesSection authorized={authorized} />}
          {section === 'documents' && <DocumentsSection authorized={authorized} />}
          {section === 'search' && <SearchSection />}
        </div>
      </div>
    </RoleGuard>
  );
}
