'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetCompaniesQuery, useGetCompanyQuery } from '@/redux/services';
import { cn } from '@/lib/utils';

/** ObjectId'yi okunabilir kılmak için kısaltır. */
export function shortId(id) {
  const s = String(id ?? '');
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s || '—';
}

/**
 * Firma seçici: ObjectId yazmak yerine ada göre arayıp seçtirir; dışarı `value`
 * olarak companyId döner. `initialLabel` (ör. companyContext.company.name) düzenleme
 * modunda mevcut firmanın adını göstermek için verilir; yoksa id'den ada çözer.
 *
 * CMS genelinde paylaşılır (fetcher domain sihirbazı, embedding arama testi, …).
 */
export default function CompanySelect({
  value,
  initialLabel,
  onChange,
  placeholder = 'Firma seç (opsiyonel)',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pickedLabel, setPickedLabel] = useState(initialLabel || '');
  const rootRef = useRef(null);

  const { data, isFetching } = useGetCompaniesQuery(
    { query: search.trim() || undefined, limit: 20 },
    { skip: !open },
  );
  const items = data?.items ?? [];

  // value var ama etiket yoksa (eski kayıt, context'siz) id'den adı çöz.
  const needLabelLookup = Boolean(value) && !pickedLabel;
  const { data: current } = useGetCompanyQuery(value, { skip: !needLabelLookup });
  const label = pickedLabel || current?.companyName || (value ? shortId(value) : '');

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const pick = (c) => {
    onChange(c?.id || '');
    setPickedLabel(c ? (c.companyName || c.id) : '');
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm hover:bg-accent"
        >
          <span className={cn('flex min-w-0 items-center gap-2', !value && 'text-muted-foreground')}>
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{value ? label : placeholder}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
        {value ? (
          <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" title="Firmayı kaldır"
            onClick={() => pick(null)}>
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-md border border-border px-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Firma adı ara…"
                className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {isFetching ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Aranıyor…
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                {search.trim() ? 'Firma bulunamadı.' : 'Aramak için yazın.'}
              </p>
            ) : (
              items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{c.companyName || shortId(c.id)}</span>
                    {(c.email || c.slug) ? <span className="block truncate text-xs text-muted-foreground">{c.email || c.slug}</span> : null}
                  </span>
                  {value === c.id ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
