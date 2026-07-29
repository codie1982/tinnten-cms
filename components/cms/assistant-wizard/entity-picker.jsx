'use client';

/**
 * Kapsam ID'leri için seçici. Firma seçiliyse o firmanın ürün/hizmet listesinden
 * arayarak seçtirir; firma yoksa (havuz asistanı) ID'ler elle girilir.
 *
 * Dashboard'daki AssistantEntityPicker firma bağlamını `getMyProducts` ile
 * çözer — CMS'te asistan firmasız da oluşturulabildiği için manuel giriş
 * her zaman açık kalır.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Package, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetCmsProductsQuery } from '@/redux/services';
import { cn } from '@/lib/utils';

const shortId = (id) => {
  const s = String(id ?? '');
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};

export function ProductPicker({ companyId, type = 'product', value = [], onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState('');
  const [labels, setLabels] = useState({}); // id → başlık (seçtikten sonra göstermek için)
  const rootRef = useRef(null);

  const { data, isFetching } = useGetCmsProductsQuery(
    { companyid: companyId, type, query: search.trim() || undefined, limit: 20 },
    { skip: !open || !companyId },
  );
  const items = data?.items ?? [];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = (id, label) => {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
      return;
    }
    setLabels((prev) => ({ ...prev, [id]: label }));
    onChange([...value, id]);
  };

  const addManual = () => {
    const v = manual.trim();
    if (!v || value.includes(v)) {
      setManual('');
      return;
    }
    onChange([...value, v]);
    setManual('');
  };

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="flex gap-1.5">
        {companyId ? (
          <div className="relative flex-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Package className="size-3.5" />
                Listeden seç…
              </span>
              <Search className="size-3.5 text-muted-foreground" />
            </button>
            {open && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                <div className="border-b border-border p-2">
                  <div className="flex items-center gap-2 rounded-md border border-border px-2">
                    <Search className="size-3.5 shrink-0 text-muted-foreground" />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Ara…"
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
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
                  ) : (
                    items.map((p) => {
                      const id = String(p.id ?? p._id);
                      const title = p.title || shortId(id);
                      const selected = value.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggle(id, title)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground">{title}</span>
                            {/* Taslak ürünler gizlenmez, rozetle gösterilir — gizleseydik
                                operatör ürününü neden bulamadığını anlayamazdı. */}
                            {p.status && p.status !== 'active' ? (
                              <Badge variant="warning" className="mt-0.5">{p.status}</Badge>
                            ) : null}
                          </span>
                          {selected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
        <Input
          value={manual}
          disabled={disabled}
          placeholder={companyId ? 'veya ID yapıştır…' : 'ID yapıştır…'}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addManual();
            }
          }}
          className={cn(companyId ? 'flex-1' : 'w-full')}
        />
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => (
            <Badge key={id} variant="muted" className="gap-1 pe-1 font-mono text-[11px]">
              {labels[id] || shortId(id)}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== id))}
                disabled={disabled}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label="kaldır"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductPicker;
