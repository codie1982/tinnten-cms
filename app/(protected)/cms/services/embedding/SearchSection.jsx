'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import CompanySelect from '@/components/cms/company-select';
import { useEmbeddingSearchMutation } from '@/redux/services';

/** Semantik vektör aramasını elle deneme kutusu. */
export default function SearchSection() {
  const [query, setQuery] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [runSearch, { data, isLoading }] = useEmbeddingSearchMutation();

  const submit = async () => {
    if (!query.trim()) return;
    await runSearch({ query: query.trim(), companyId: companyId.trim() || undefined, k: 10 }).unwrap().catch(() => {});
  };

  const results = data?.results || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1 space-y-1.5">
              <label className="text-2sm font-medium">Arama metni</label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Semantik olarak aranacak ifade…" />
            </div>
            <div className="w-64 space-y-1.5">
              <label className="text-2sm font-medium">Firma kapsamı (opsiyonel)</label>
              <CompanySelect value={companyId} onChange={setCompanyId} placeholder="Tüm firmalar" />
            </div>
            <Button onClick={submit} disabled={!query.trim() || isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Ara
            </Button>
          </div>
          {data && data.ok === false && (
            <Alert variant="warning"><AlertTitle>Arama yapılamadı</AlertTitle><AlertDescription>{data.reason || 'Bilinmeyen hata.'}</AlertDescription></Alert>
          )}
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Sonuçlar</CardTitle>
            <CardToolbar><Badge variant="muted">{results.length} chunk</Badge></CardToolbar>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.length === 0 ? <p className="text-sm text-muted-foreground">Eşleşme bulunamadı.</p> : (
              results.map((r, i) => (
                <div key={r.chunk_id || r.id || i} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{r.doc_id || r.metadata?.url || r.id || '—'}</span>
                    {typeof r.score === 'number' && <Badge variant="primary">skor {r.score.toFixed(3)}</Badge>}
                  </div>
                  <p className="line-clamp-3 text-sm text-foreground">{r.text || '(metin yok)'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
