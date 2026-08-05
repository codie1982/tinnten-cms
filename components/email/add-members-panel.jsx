'use client';

import { useState, useRef, useMemo } from 'react';
import { UserPlus, Search, Upload, Loader2, Plus, PenLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  useGetCmsSubscribersQuery,
  useAddChannelMembersMutation,
} from '@/redux/services';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCSVEmails(text) {
  const emails = new Set();
  let totalRows = 0; // boş olmayan satır sayısı (başlık dahil)
  let matchedRows = 0; // en az bir e-posta içeren satır
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    totalRows++;
    let matched = false;
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    for (const cell of cells) {
      if (EMAIL_RE.test(cell)) {
        emails.add(cell.toLowerCase());
        matched = true;
      }
    }
    if (matched) matchedRows++;
  }
  return { emails: [...emails], totalRows, matchedRows, skippedRows: totalRows - matchedRows };
}

// Manuel giriş: satır/virgül/noktalı virgül/boşluk ayraçlı serbest metin.
// Sisteme kayıtlı olmayan adresler de eklenebilir — backend e-postayla upsert eder.
function parseManualEmails(text) {
  const tokens = String(text || '')
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const emails = [...new Set(tokens.filter((t) => EMAIL_RE.test(t)).map((t) => t.toLowerCase()))];
  const invalid = tokens.filter((t) => !EMAIL_RE.test(t));
  return { emails, invalid };
}

export function AddMembersPanel({ channelKey, authorized, note }) {
  const [tab, setTab] = useState('search');
  const [notice, setNotice] = useState('');
  const [addMembers, { isLoading: adding }] = useAddChannelMembersMutation();

  // Kullanıcı ara sekmesi
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(new Set());
  const { data: searchData, isFetching: searching } = useGetCmsSubscribersQuery(
    { q, limit: 20 },
    { skip: !authorized || q.trim().length < 2 },
  );
  const searchResults = searchData?.items ?? [];

  // Manuel sekmesi — kayıtlı olmayan adresleri elle ekleme
  const [manualText, setManualText] = useState('');
  const [manualName, setManualName] = useState('');
  const manualParsed = useMemo(() => parseManualEmails(manualText), [manualText]);

  // CSV sekmesi
  const [csvEmails, setCsvEmails] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [csvStats, setCsvStats] = useState(null);
  const fileRef = useRef(null);

  const toggleSelect = (email) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { emails, totalRows, matchedRows, skippedRows } = parseCSVEmails(ev.target.result);
      setCsvEmails(emails);
      setCsvStats({ totalRows, matchedRows, skippedRows });
      if (!emails.length) {
        setCsvError(
          totalRows
            ? `Dosyada geçerli e-posta bulunamadı (${totalRows.toLocaleString('tr-TR')} satır tarandı). Her satırda bir e-posta adresi olmalı.`
            : 'Dosya boş görünüyor.',
        );
      }
    };
    reader.readAsText(file);
  };

  const clearCsv = () => {
    setCsvEmails([]);
    setCsvError('');
    setCsvStats(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleAdd = async () => {
    const emails =
      tab === 'search' ? [...selected] : tab === 'manual' ? manualParsed.emails : csvEmails;
    if (!emails.length) return;
    setNotice('');
    const payload = { key: channelKey, emails };
    // Backend profile'ı yalnız tek-email eklemede uygular (addChannelMembers).
    if (tab === 'manual' && emails.length === 1 && manualName.trim()) {
      payload.profile = { name: manualName.trim() };
    }
    const r = await addMembers(payload)
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Eklenemedi' }));
    if (r?.__err) return setNotice(r.__err);
    setSelected(new Set());
    setManualText('');
    setManualName('');
    clearCsv();
    // Bastırılmış (abonelikten çıkmış/engellenmiş) adresler backend'de kanala abone
    // EDİLMEZ ve `added` sayılmaz — operatör "eklendi" sanmasın diye ayrıca listelenir.
    const suppressed = r?.suppressed ?? [];
    const suppressedNote = suppressed.length
      ? ` ${suppressed.length} adres bastırılmış olduğu için abone edilmedi: ${suppressed
          .slice(0, 3)
          .join(', ')}${suppressed.length > 3 ? ` +${suppressed.length - 3}` : ''}.`
      : '';
    setNotice(
      `${r?.added ?? 0} üye eklendi.` +
        suppressedNote +
        (r?.failed?.length ? ` ${r.failed.length} başarısız.` : ''),
    );
  };

  const canAdd =
    tab === 'search'
      ? selected.size > 0
      : tab === 'manual'
        ? manualParsed.emails.length > 0
        : csvEmails.length > 0;

  // Kenar yuvarlaması sekme sayısından bağımsız: kapsayıcı `overflow-hidden rounded-md` kırpıyor.
  const tabBtn = (key, icon, label) => (
    <button
      onClick={() => setTab(key)}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors',
        tab === key
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon} {label}
    </button>
  );

  return (
    <Card className="lg:sticky lg:top-4 lg:self-start">
      <CardHeader>
        <CardTitle><UserPlus className="mr-1 inline size-4" /> Üye Ekle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {/* Sekme geçişi */}
        <div className="flex overflow-hidden rounded-md border border-border">
          {tabBtn('search', <Search className="size-3.5" />, 'Ara')}
          {tabBtn('manual', <PenLine className="size-3.5" />, 'Manuel')}
          {tabBtn('csv', <Upload className="size-3.5" />, 'CSV')}
        </div>

        {/* Kullanıcı ara */}
        {tab === 'search' && (
          <>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="E-posta veya isim ara…"
              autoComplete="off"
            />
            {q.trim().length >= 2 && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                {searching ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="space-y-1.5 py-4 text-center">
                    <p className="text-xs text-muted-foreground">Sonuç bulunamadı.</p>
                    {/* Arama yalnız kayıtlı aboneleri tarar — kayıtsız adres için Manuel sekmesine geçir. */}
                    <button
                      onClick={() => {
                        setTab('manual');
                        if (EMAIL_RE.test(q.trim())) setManualText(q.trim());
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Kayıtlı olmayan adresi manuel ekle →
                    </button>
                  </div>
                ) : (
                  searchResults.map((s) => (
                    <label
                      key={s.email}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(s.email)}
                        onChange={() => toggleSelect(s.email)}
                        className="size-3.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{s.email}</span>
                      {s.profile?.name && (
                        <span className="shrink-0 text-xs text-muted-foreground">{s.profile.name}</span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}
            {selected.size > 0 && (
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{selected.size} seçili</Badge>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Seçimi temizle
                </button>
              </div>
            )}
          </>
        )}

        {/* Manuel ekle — sisteme kayıtlı olmayan adresler dahil */}
        {tab === 'manual' && (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                E-posta adresleri — her satıra bir adres (virgülle de ayrılabilir)
              </label>
              <textarea
                className="h-20 w-full rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                spellCheck={false}
                placeholder={'ornek@firma.com\nikinci@firma.com'}
              />
            </div>
            {manualParsed.emails.length === 1 && (
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="İsim (opsiyonel)"
                autoComplete="off"
              />
            )}
            {manualParsed.emails.length > 0 && (
              <Badge variant="secondary">{manualParsed.emails.length} geçerli adres</Badge>
            )}
            {manualParsed.invalid.length > 0 && (
              <p className="text-xs text-destructive">
                Geçersiz: {manualParsed.invalid.slice(0, 3).join(', ')}
                {manualParsed.invalid.length > 3 ? ` +${manualParsed.invalid.length - 3}` : ''}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Sisteme kayıtlı olmayan adresler de eklenebilir. Abonelikten çıkmış (bastırılmış)
              adresler yeniden abone edilmez.
            </p>
          </>
        )}

        {/* CSV yükle */}
        {tab === 'csv' && (
          <>
            <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Gerekli format:</span> her satırda bir e-posta adresi.
                İlk satır başlık olabilir; virgül (,), noktalı virgül (;) veya tab ile ayrılmış sütunlar desteklenir,
                e-posta hangi sütunda olursa olsun bulunur.
              </p>
              <p>
                Yalnızca ad-soyad içeren (e-postasız) satırlar atlanır — ör. Google Ads / LinkedIn dışa
                aktarımlarında kişilerin çoğunda e-posta bulunmaz.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="w-full text-xs file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            {csvError && <p className="text-xs text-destructive">{csvError}</p>}
            {csvEmails.length > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant="secondary">{csvEmails.length} e-posta bulundu</Badge>
                  <button onClick={clearCsv} className="text-xs text-muted-foreground hover:text-foreground">
                    Temizle
                  </button>
                </div>
                {csvStats?.skippedRows > 0 && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {csvStats.totalRows.toLocaleString('tr-TR')} satır tarandı ·{' '}
                    {csvStats.skippedRows.toLocaleString('tr-TR')} satır e-posta içermediği için atlandı.
                  </p>
                )}
                <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                  {csvEmails.slice(0, 30).map((e) => (
                    <div key={e} className="px-3 py-1 font-mono text-xs odd:bg-muted/30">{e}</div>
                  ))}
                  {csvEmails.length > 30 && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground">
                      … ve {csvEmails.length - 30} adres daha
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <Button onClick={handleAdd} disabled={adding || !canAdd} className="w-full">
          {adding
            ? <Loader2 className="size-4 animate-spin" />
            : <Plus className="size-4" />}
          {tab === 'search'
            ? selected.size > 0 ? `${selected.size} Kullanıcıyı Ekle` : 'Seçim yapılmadı'
            : tab === 'manual'
              ? manualParsed.emails.length > 0
                ? `${manualParsed.emails.length} Adresi Ekle`
                : 'E-posta girilmedi'
              : csvEmails.length > 0 ? `${csvEmails.length} Adresi Ekle` : 'Dosya seçilmedi'}
        </Button>

        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}

        {notice && (
          <Alert variant="info">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
