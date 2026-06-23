'use client';

import { useState } from 'react';
import { Loader2, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetCompaniesQuery } from '@/redux/services';

/**
 * Firma arama + seçim bileşeni — `GET /company/cms/list` (param `query`, `data.items`).
 * Arama+"Ara" submit kalıbı companies/list sayfasından uyarlandı.
 * Seçilen firma `value` (companyId) ile yukarı taşınır; `onChange(id, company)` ile bildirilir.
 */
export default function CompanySearchSelect({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  const applySearch = () => setSubmittedSearch(search.trim());

  const { data, isFetching } = useGetCompaniesQuery(
    { query: submittedSearch || undefined, limit: 10 },
    { skip: !submittedSearch },
  );

  const companies = data?.items ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Firma adı, e-posta veya slug ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applySearch(); } }}
            className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
          />
        </div>
        <Button type="button" variant="outline" onClick={applySearch} disabled={isFetching || !search.trim()}>
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Ara
        </Button>
      </div>

      {submittedSearch && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
          {isFetching ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Aranıyor…</p>
          ) : companies.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Firma bulunamadı.</p>
          ) : (
            companies.map((c) => {
              const cid = c._id ?? c.id;
              const selected = String(value) === String(cid);
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => onChange(cid, c)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    selected ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {c.companyName || c.name || cid}
                    {(c.email || c.slug) && (
                      <span className="ms-1 text-[11px] text-muted-foreground">· {c.email || c.slug}</span>
                    )}
                  </span>
                  {selected && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
