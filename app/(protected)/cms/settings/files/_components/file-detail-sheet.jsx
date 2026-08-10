'use client';

import { useState } from 'react';
import {
  ExternalLink, Download, Copy, Check, FileText, AlertTriangle,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useGetFileContentQuery } from '@/redux/services';
import { SOURCE_META, formatBytes, formatTrDateTime } from '../_lib/file-meta';

const CHANNEL_LABEL = {
  cms: 'CMS paneli',
  web: 'Web uygulaması',
  embed: 'Gömülü asistan',
  mobile: 'Mobil',
  api: 'Doğrudan API',
  system: 'Sunucu içi üretim',
  unknown: 'Bilinmiyor',
};

const DOC_SOURCE_LABEL = {
  upload: 'Dosya yüklemesi',
  import_url: 'URL’den içe aktarma',
  integration: 'Entegrasyon',
};

function Row({ label, children }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground">{children}</span>
    </div>
  );
}

function ContentBlock({ content, contentError, mediaType, previewUrl, name }) {
  const [copied, setCopied] = useState(false);

  if (contentError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>İçerik okunamadı</AlertTitle>
        <AlertDescription>{contentError}</AlertDescription>
      </Alert>
    );
  }

  if (mediaType === 'image' && previewUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={previewUrl} alt={name} className="max-h-[420px] w-full rounded-lg object-contain" />;
  }
  if (mediaType === 'video' && previewUrl) {
    return <video src={previewUrl} controls className="max-h-[420px] w-full rounded-lg" />;
  }
  if (mediaType === 'audio' && previewUrl) {
    return <audio src={previewUrl} controls className="w-full" />;
  }

  const text = content?.extractedText || '';
  if (!text.trim()) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
        <FileText className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Metin içeriği yok</p>
        <p className="text-xs text-muted-foreground">
          Dosya henüz ayrıştırılmamış olabilir ya da metin içermiyor.
        </p>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* pano erişimi yoksa sessiz geç */
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {content.totalLength.toLocaleString('tr-TR')} karakter
          {content.truncated ? ' — ilk 200.000 karakter gösteriliyor' : ''}
        </span>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </Button>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
        {text}
      </pre>
    </div>
  );
}

/** Dosya detayı: kaynak künyesi + içerik önizlemesi (cms:admin). */
export function FileDetailSheet({ fileId, open, onOpenChange }) {
  const { data, isFetching, isError } = useGetFileContentQuery(fileId, {
    skip: !fileId || !open,
  });

  const f = data?.file;
  const source = SOURCE_META[f?.sourceGroup] ?? SOURCE_META.media;
  const us = f?.uploadSource ?? {};
  const sourceUrl = us.sourceUrl || data?.document?.url || '';
  const linkClass = buttonVariants({ variant: 'outline', size: 'sm' });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pe-8">
          <SheetTitle className="truncate">{f?.name || 'Dosya detayı'}</SheetTitle>
          <SheetDescription className="truncate">{f?.originalName || ''}</SheetDescription>
        </SheetHeader>

        {isError ? (
          <Alert variant="destructive">
            <AlertTitle>Yüklenemedi</AlertTitle>
            <AlertDescription>Dosya detayı alınamadı.</AlertDescription>
          </Alert>
        ) : isFetching || !f ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={source.badge}>{source.label}</Badge>
              <Badge variant="muted">{f.mediaType}</Badge>
              {f.processingStatus && <Badge variant="outline">{f.processingStatus}</Badge>}
            </div>

            {/* ── Kaynak künyesi ── */}
            <section>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Kaynak</h3>
              <div className="rounded-lg border p-3">
                <Row label="Kaynak grubu">{source.label}</Row>
                <Row label="Akış (fileScope)">{f.fileScope}</Row>
                <Row label="Yükleyen istemci">
                  {us.channel ? (CHANNEL_LABEL[us.channel] || us.channel) : (
                    <span className="text-muted-foreground">
                      Kayıtsız — bu alan eklenmeden önce yüklenmiş
                    </span>
                  )}
                </Row>
                <Row label="Uç nokta">{us.surface}</Row>
                <Row label="İstemci adresi">{us.clientOrigin}</Row>
                <Row label="Üreten araç">{us.toolName}</Row>
                {sourceUrl && (
                  <Row label="Kaynak URL">
                    <a
                      className="text-primary underline underline-offset-2"
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {sourceUrl}
                    </a>
                  </Row>
                )}
                <Row label="Konuşma">{f.conversationId}</Row>
                <Row label="AI modeli">{f.aiModel}</Row>
                <Row label="AI istemi">{f.aiPrompt}</Row>
                {data.document && (
                  <>
                    <Row label="Doküman kaydı">{data.document.name}</Row>
                    <Row label="Ekleme yolu">
                      {DOC_SOURCE_LABEL[data.document.source] || data.document.source}
                    </Row>
                    <Row label="Firma">{data.document.companyId}</Row>
                    <Row label="İndeks durumu">{data.document.indexState}</Row>
                  </>
                )}
              </div>
            </section>

            {/* ── Dosya künyesi ── */}
            <section>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Dosya bilgileri</h3>
              <div className="rounded-lg border p-3">
                <Row label="Sahibi">{f.owner || f.userId}</Row>
                <Row label="Boyut">{formatBytes(f.sizeBytes)}</Row>
                <Row label="MIME">{f.mimeType}</Row>
                <Row label="Eklenme">{formatTrDateTime(f.createdAt)}</Row>
                <Row label="Durum">{f.status}</Row>
                <Row label="Sayfa / karakter">
                  {f.pageCount || f.textLength
                    ? `${f.pageCount || 0} sayfa · ${(f.textLength || 0).toLocaleString('tr-TR')} karakter`
                    : null}
                </Row>
                <Row label="Etiketler">{f.tags?.length ? f.tags.join(', ') : null}</Row>
              </div>
            </section>

            {data.inspect?.warnings?.length > 0 && (
              <Alert variant="warning">
                <AlertTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-4" /> Ayrıştırma uyarıları
                </AlertTitle>
                <AlertDescription>{data.inspect.warnings.join(', ')}</AlertDescription>
              </Alert>
            )}

            {/* ── İçerik ── */}
            <section>
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">İçerik</h3>
                {data.previewUrl && (
                  <div className="flex gap-2">
                    <a className={linkClass} href={data.previewUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" /> Aç
                    </a>
                    <a className={linkClass} href={data.previewUrl} download={f.originalName || f.name}>
                      <Download className="size-3.5" /> İndir
                    </a>
                  </div>
                )}
              </div>
              <ContentBlock
                content={data.content}
                contentError={data.contentError}
                mediaType={f.mediaType}
                previewUrl={data.previewUrl}
                name={f.name}
              />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default FileDetailSheet;
