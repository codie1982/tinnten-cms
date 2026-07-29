'use client';

/**
 * Bilgi Tabanı adımı — RAG kaynakları.
 *
 * `websiteIds` firmanın `information.websites[]._id` değerleridir (fetcher
 * abonelik id'leri DEĞİL — bkz. CompanyDataAccessor.getKnowledgeWebsites).
 * Firma seçiliyse bu liste CMS firma detayından okunup seçtirilir; firmasız
 * asistanda kaynak bağlanamayacağı için yalnız manuel giriş kalır.
 *
 * Dashboard'dan farkı: bu adım RAG kapalıyken de görünür. Operatör önce kaynağı
 * bağlayıp sonra RAG'i açabilmeli; dashboard sekmeyi tamamen gizliyor.
 */

import { AlertCircle, Database, FileText, Globe, Library } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetCompanyQuery } from '@/redux/services';
import {
  LIBRARY_RAG_CAPABILITY_KEY,
  getTool,
  isLibraryRagEnabled,
  toggleCapability,
} from '@/lib/assistant-capabilities';
import { cn } from '@/lib/utils';
import { Field, TagInput, ToggleRow } from './shared';

export function LibraryStep({ w }) {
  const lib = w.library;
  const setLib = (patch) => w.set('library', { ...lib, ...patch });
  const ragOn = isLibraryRagEnabled(w.capabilities.disabledCapabilities);

  const defaultTool = getTool('DefaultTool');
  const ragCap = defaultTool.capabilities.find((c) => c.id === 'library_rag_search');

  const toggleRag = (next) =>
    w.set('capabilities', {
      ...w.capabilities,
      disabledCapabilities: toggleCapability(
        'DefaultTool',
        ragCap,
        w.capabilities.disabledCapabilities,
        next,
      ),
    });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Semantik Arama (RAG)</CardTitle>
          <CardToolbar>
            <Badge variant={ragOn ? 'success' : 'muted'}>{ragOn ? 'Açık' : 'Kapalı'}</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <ToggleRow
            label="Bilgi tabanında semantik arama"
            hint={`Kapalıyken aşağıda bağlanan kaynaklar konuşmada kullanılmaz. Anahtar: ${LIBRARY_RAG_CAPABILITY_KEY}`}
            checked={ragOn}
            onChange={toggleRag}
          />
          {!ragOn && (lib.libraryIds.length || lib.fileIds.length || lib.websiteIds.length) ? (
            <Alert variant="warning">
              <AlertDescription>
                Kaynak bağladınız ama semantik arama kapalı — asistan bu kaynakları
                okuyamaz. Yukarıdaki anahtarı açın.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <WebsiteSection companyId={w.companyId} value={lib.websiteIds} onChange={(v) => setLib({ websiteIds: v })} />

      <Card>
        <CardHeader>
          <CardTitle>Kütüphaneler & Dosyalar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <Field
            label={<span className="inline-flex items-center gap-1.5"><Library className="size-3.5" />Kütüphane ID&apos;leri</span>}
            hint="content-library kayıtları."
          >
            <TagInput value={lib.libraryIds} onChange={(v) => setLib({ libraryIds: v })} placeholder="libraryId…" />
          </Field>
          <Field
            label={<span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" />Dosya ID&apos;leri</span>}
            hint="Tekil dosya kayıtları."
          >
            <TagInput value={lib.fileIds} onChange={(v) => setLib({ fileIds: v })} placeholder="fileId…" />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

function WebsiteSection({ companyId, value, onChange }) {
  const { data: company, isLoading } = useGetCompanyQuery(companyId, { skip: !companyId });
  const websites = company?.information?.websites ?? [];

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firma Web İçerikleri</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{value.length} seçili</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {!companyId ? (
          <>
            <Alert variant="info">
              <AlertDescription>
                Asistan henüz bir firmaya bağlı değil. Web içerikleri firmanın taranmış
                sitelerinden gelir — sayfanın üstündeki <span className="font-medium">Firma</span>
                {' '}alanından bir firma seçin ya da asistanı oluşturup listeden aktardıktan
                sonra kaynakları bağlayın.
              </AlertDescription>
            </Alert>
            <Field label="Web içerik ID'leri" hint="Biliyorsanız elle girebilirsiniz.">
              <TagInput value={value} onChange={onChange} placeholder="websiteId…" />
            </Field>
          </>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : websites.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-10 text-center">
            <Globe className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Bu firmanın taranmış web içeriği yok.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {websites.map((site) => {
              const id = String(site._id);
              const on = value.includes(id);
              const chunks = Number(site?.content?.embedding?.chunkCount || 0);
              // Backend yalnız embedding'i açık VE chunk'ı olan siteleri RAG
              // kapsamına alır — seçilebilir ama sonuçsuz kalacakları belirtilir.
              const usable = site?.content?.embedding?.enabled !== false && chunks > 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                    on ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                  )}
                >
                  <input type="checkbox" checked={on} readOnly className="mt-1 size-3.5 accent-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {site.title || site.domain || id}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{site.url || site.domain}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant="muted" className="gap-1">
                        <Database className="size-3" />
                        {chunks} parça
                      </Badge>
                      {site?.content?.embedding?.status ? (
                        <Badge variant="muted">{site.content.embedding.status}</Badge>
                      ) : null}
                      {!usable ? (
                        <Badge variant="warning" className="gap-1">
                          <AlertCircle className="size-3" />
                          indekslenmemiş
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LibraryStep;
