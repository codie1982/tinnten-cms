'use client';

// Dosya önizleme motoru — istemci uygulamasındaki
// `tinnten-nextjs/src/components/library/detail/FileDetailView.tsx` akışının
// CMS karşılığı. Aynı ilke: ham `path`/`/raw` adresi kullanılamaz (private
// bucket → 403, /raw Bearer header ister → <img>/<iframe> gönderemez → 401),
// bu yüzden her şey backend'in ürettiği KISA ÖMÜRLÜ İMZALI adres üzerinden gider.
//
// mammoth / xlsx / dompurify DİNAMİK import edilir: paneli açan her admin
// oturumuna ~1MB parser yüklemenin anlamı yok, yalnız o türde bir dosya
// açıldığında indirilir.

import { useEffect, useState } from 'react';
import { FileText, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const EXT_MAP = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'ogv'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
  pdf: ['pdf'],
  docx: ['docx'],
  xlsx: ['xlsx', 'xls', 'csv'],
  text: ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'xml', 'yaml', 'yml', 'html', 'js', 'ts', 'css'],
};

/** Uzantı + mediaType'tan önizleme tipini çözer. */
export function resolvePreviewType(file) {
  const ext = String(file?.extension || '').toLowerCase().replace(/^\./, '');
  for (const [type, list] of Object.entries(EXT_MAP)) {
    if (list.includes(ext)) return type;
  }
  // Uzantı yoksa mediaType'a düş — AI görselleri uzantısız kaydedilebiliyor.
  if (['image', 'video', 'audio'].includes(file?.mediaType)) return file.mediaType;
  if (String(file?.mimeType || '').includes('pdf')) return 'pdf';
  return 'none';
}

function Frame({ children, className }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-muted/20', className)}>
      {children}
    </div>
  );
}

function Center({ icon: Icon, spin, children }) {
  return (
    <Frame className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <Icon className={cn('size-6 text-muted-foreground', spin && 'animate-spin')} />
      <p className="px-6 text-sm text-muted-foreground">{children}</p>
    </Frame>
  );
}

/** DOCX → HTML (mammoth) + DOMPurify temizliği. */
function DocxPreview({ url }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`İndirilemedi (${res.status})`);
        const buffer = await res.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        // Belge içeriği güvenilmez (kullanıcı yüklüyor) — HTML mutlaka temizlenir.
        const purify = (await import('isomorphic-dompurify')).default;
        if (!cancelled) setHtml(purify.sanitize(result.value));
      } catch (err) {
        if (!cancelled) setError(err?.message || 'DOCX dönüştürülemedi.');
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (error) return <Center icon={AlertCircle}>{error}</Center>;
  if (html === null) return <Center icon={Loader2} spin>Belge dönüştürülüyor…</Center>;
  return (
    <Frame className="max-h-[60vh] overflow-y-auto bg-background">
      <div
        className="prose prose-sm max-w-none p-6 text-sm dark:prose-invert"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Frame>
  );
}

/** XLSX/CSV → tablo (SheetJS). */
function XlsxPreview({ url }) {
  const [table, setTable] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`İndirilemedi (${res.status})`);
        const buffer = await res.arrayBuffer();
        const XLSX = await import('xlsx');
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (cancelled) return;
        setTable({
          sheetNames: wb.SheetNames,
          headers: (rows[0] || []).map((h) => String(h)),
          // 200 satır sınırı: 50k satırlık bir tabloyu DOM'a basmak paneli kilitler.
          rows: rows.slice(1, 201).map((r) => r.map((c) => String(c ?? ''))),
          totalRows: Math.max(0, rows.length - 1),
        });
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Tablo okunamadı.');
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (error) return <Center icon={AlertCircle}>{error}</Center>;
  if (!table) return <Center icon={Loader2} spin>Tablo yükleniyor…</Center>;

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {table.sheetNames.length > 1 && `${table.sheetNames.length} sayfa (ilki gösteriliyor) · `}
        {table.totalRows.toLocaleString('tr-TR')} satır
        {table.totalRows > 200 && ' — ilk 200 satır'}
      </p>
      <Frame className="max-h-[60vh] overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-background/95 backdrop-blur">
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="whitespace-nowrap border-b px-3 py-2 text-left font-semibold text-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="even:bg-muted/30">
                {table.headers.map((_, j) => (
                  <td key={j} className="whitespace-nowrap border-b border-border/40 px-3 py-1.5 text-muted-foreground">
                    {r[j] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Frame>
    </div>
  );
}

/**
 * Dosya önizlemesi.
 *
 * @param file      mapFile çıktısı (extension, mediaType, mimeType, name)
 * @param previewUrl imzalı adres (yoksa yalnız metne düşülür)
 * @param text      backend'in ayrıştırdığı metin (fallback)
 */
export function FilePreview({ file, previewUrl, text }) {
  const type = resolvePreviewType(file);

  if (previewUrl) {
    if (type === 'image') {
      return (
        <Frame className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={file.name} className="max-h-[60vh] w-full object-contain" />
        </Frame>
      );
    }
    if (type === 'video') {
      return <Frame className="bg-black"><video src={previewUrl} controls className="max-h-[60vh] w-full" /></Frame>;
    }
    if (type === 'audio') {
      return <Frame className="p-6"><audio src={previewUrl} controls className="w-full" /></Frame>;
    }
    if (type === 'pdf') {
      return (
        <Frame className="h-[65vh]">
          <iframe src={previewUrl} title={file.name} className="size-full" />
        </Frame>
      );
    }
    if (type === 'docx') return <DocxPreview url={previewUrl} />;
    if (type === 'xlsx') return <XlsxPreview url={previewUrl} />;
  }

  // Metin türleri ve önizleme adresi olmayan her şey: backend'in çıkardığı metin.
  if (text && text.trim()) {
    return (
      <Frame className="max-h-[60vh] overflow-auto">
        <pre className="whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-foreground">
          {text}
        </pre>
      </Frame>
    );
  }

  return (
    <Center icon={FileText}>
      Önizlenecek içerik yok — dosya ayrıştırılmamış olabilir ya da bu tür için önizleme desteklenmiyor.
    </Center>
  );
}

export default FilePreview;
