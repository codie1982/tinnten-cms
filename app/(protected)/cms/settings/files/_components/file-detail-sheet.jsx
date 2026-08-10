'use client';

import { useState } from 'react';
import {
  ExternalLink, Download, Copy, Check, AlertTriangle, ShieldCheck, ShieldAlert,
  Shield, Link2, MessageSquare, Mail, Sparkles,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useGetFileContentQuery } from '@/redux/services';
import { FilePreview } from './file-preview';
import {
  SOURCE_META, SCAN_META, PROCESSING_LABEL, USAGE_LABEL,
  formatBytes, formatTrExact, formatRelativeTr,
} from '../_lib/file-meta';

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

function Row({ label, children, mono }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-border/40 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-foreground ${mono ? 'font-mono text-xs' : ''}`}>
        {children}
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, children, tone }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {Icon && <Icon className={`size-4 ${tone || 'text-muted-foreground'}`} />}
        {title}
      </h3>
      <div className="rounded-lg border px-3">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return (
    <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** İçerik sekmesi: önizleme + ayrıştırılmış metin. */
function PreviewTab({ data, f }) {
  const [copied, setCopied] = useState(false);
  const text = data.content?.extractedText || '';
  const linkClass = buttonVariants({ variant: 'outline', size: 'sm' });

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {data.content
            ? `${data.content.totalLength.toLocaleString('tr-TR')} karakter${data.content.truncated ? ' — ilk 200.000 gösteriliyor' : ''}`
            : 'Metin ayrıştırması yok'}
        </span>
        <div className="flex gap-2">
          {text && (
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Kopyalandı' : 'Metni kopyala'}
            </Button>
          )}
          {data.previewUrl && (
            <>
              <a className={linkClass} href={data.previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Aç
              </a>
              <a className={linkClass} href={data.previewUrl} download={f.originalName || f.name}>
                <Download className="size-3.5" /> İndir
              </a>
            </>
          )}
        </div>
      </div>

      {data.contentError && (
        <Alert variant="warning">
          <AlertTitle>Metin okunamadı</AlertTitle>
          <AlertDescription>{data.contentError}</AlertDescription>
        </Alert>
      )}

      <FilePreview file={f} previewUrl={data.previewUrl} text={text} />
    </div>
  );
}

/** Kaynak sekmesi: kim, ne zaman, nereden, hangi konuşma, AI mı. */
function SourceTab({ data, f }) {
  const source = SOURCE_META[f.sourceGroup] ?? SOURCE_META.media;
  const us = f.uploadSource ?? {};
  const up = data.uploader;
  const conv = data.conversation;
  const ai = data.aiTrail;
  const sourceUrl = us.sourceUrl || data.document?.url || '';

  return (
    <div className="space-y-5">
      <Section title="Kim, ne zaman ekledi">
        <Row label="Yükleyen">
          {up?.name || up?.username || f.owner || (
            <span className="text-muted-foreground">Bilinmiyor</span>
          )}
          {up && !up.found && <span className="ms-2 text-xs text-amber-600">(kullanıcı kaydı bulunamadı)</span>}
        </Row>
        <Row label="E-posta">{up?.email}</Row>
        <Row label="Kullanıcı ID" mono>{up?.id || f.userId}</Row>
        <Row label="Eklenme">
          {formatTrExact(f.createdAt)}
          <span className="ms-2 text-xs text-muted-foreground">({formatRelativeTr(f.createdAt)})</span>
        </Row>
        <Row label="Son güncelleme">
          {f.updatedAt && f.updatedAt !== f.createdAt ? formatTrExact(f.updatedAt) : null}
        </Row>
        <Row label="Son erişim">{f.lastAccessedAt ? formatTrExact(f.lastAccessedAt) : null}</Row>
        <Row label="Geçerlilik sonu">{f.expiresAt ? formatTrExact(f.expiresAt) : null}</Row>
      </Section>

      <Section title="Nereden geldi" icon={Link2}>
        <Row label="Kaynak grubu"><Badge variant={source.badge}>{source.label}</Badge></Row>
        <Row label="Akış (fileScope)" mono>{f.fileScope}</Row>
        <Row label="Yükleyen istemci">
          {us.channel ? (CHANNEL_LABEL[us.channel] || us.channel) : (
            <span className="text-muted-foreground">
              Kayıtsız — bu alan eklenmeden önce yüklenmiş
            </span>
          )}
        </Row>
        <Row label="Uç nokta" mono>{us.surface}</Row>
        <Row label="İstemci adresi" mono>{us.clientOrigin}</Row>
        <Row label="Üreten araç" mono>{us.toolName}</Row>
        {sourceUrl && (
          <Row label="Kaynak URL">
            <a className="text-primary underline underline-offset-2" href={sourceUrl} target="_blank" rel="noreferrer">
              {sourceUrl}
            </a>
          </Row>
        )}
        <Row label="Yükleme ID" mono>{f.uploadid}</Row>
      </Section>

      <Section title="Konuşma bağlantısı" icon={MessageSquare}>
        {!conv ? (
          <Row label="Durum"><span className="text-muted-foreground">Bir konuşmaya bağlı değil</span></Row>
        ) : !conv.found ? (
          <>
            <Row label="Konuşma ID" mono>{conv.id}</Row>
            <Row label="Durum">
              <span className="text-amber-600">Konuşma kaydı bulunamadı (silinmiş olabilir)</span>
            </Row>
          </>
        ) : (
          <>
            <Row label="Başlık">{conv.title || <span className="text-muted-foreground">(başlıksız)</span>}</Row>
            <Row label="Konuşma ID" mono>{conv.id}</Row>
            <Row label="Özet">{conv.summary}</Row>
            <Row label="Durum">{conv.status}</Row>
            <Row label="Asistan" mono>{conv.assistantId || conv.assistantRef}</Row>
            <Row label="Başlangıç">{conv.createdAt ? formatTrExact(conv.createdAt) : null}</Row>
          </>
        )}
      </Section>

      <Section
        title="AI üretimi"
        icon={Sparkles}
        tone={ai?.generated ? 'text-amber-600' : undefined}
      >
        <Row label="Üretildi mi">
          {ai?.generated
            ? <Badge variant="warning">Evet — AI ile üretildi</Badge>
            : <Badge variant="muted">Hayır — kullanıcı yüklemesi</Badge>}
        </Row>
        {ai?.generated && (
          <>
            <Row label="Üretim türü" mono>{ai.generationType || ai.origin}</Row>
            <Row label="Model" mono>{ai.model}</Row>
            <Row label="Üreten araç" mono>{ai.toolName}</Row>
            <Row label="Üretim zamanı">{ai.generatedAt ? formatTrExact(ai.generatedAt) : null}</Row>
            <Row label="Kaynak mesaj" mono>{ai.sourceMessageId}</Row>
            <Row label="Görsel stili" mono>{ai.imageStyle}</Row>
            <Row label="Görsel boyutu" mono>{ai.imageSize}</Row>
            <Row label="Prompt">
              {ai.prompt ? (
                <span className="block max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                  {ai.prompt}
                </span>
              ) : null}
            </Row>
            <Row label="Kaynak dosyalar">
              {ai.sourceFiles?.length
                ? ai.sourceFiles.map((s) => s.name).join(', ')
                : null}
            </Row>
          </>
        )}
      </Section>

      {data.document && (
        <Section title="Bilgi tabanı kaydı">
          <Row label="Doküman adı">{data.document.name}</Row>
          <Row label="Ekleme yolu">
            {DOC_SOURCE_LABEL[data.document.source] || data.document.source}
          </Row>
          <Row label="Firma" mono>{data.document.companyId}</Row>
          <Row label="Görünürlük">{data.document.visibility}</Row>
          <Row label="İndeks durumu">{data.document.indexState}</Row>
        </Section>
      )}
    </div>
  );
}

/** Kullanım sekmesi: nerede kullanılıyor + mail izi. */
function UsageTab({ data, f }) {
  const usage = data.usage ?? { total: 0, items: [] };
  const mail = data.mail;

  const grouped = usage.items.reduce((acc, item) => {
    (acc[item.kind] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Link2 className="size-4 text-muted-foreground" />
          Nerede kullanılıyor
          <Badge variant={usage.total ? 'primary' : 'muted'}>{usage.total}</Badge>
        </h3>
        {usage.total === 0 ? (
          <Empty>
            Bu dosyaya bağlı bir kayıt bulunamadı.
            <span className="mt-1 block text-xs">
              {usage.scannedSources} bağlantı noktası tarandı (bilgi tabanı, galeri, destek talebi,
              firma/profil görseli, ürün varyantı, türetilen dosyalar).
            </span>
          </Empty>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([kind, items]) => (
              <div key={kind} className="rounded-lg border">
                <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
                  <span className="text-2sm font-medium">{USAGE_LABEL[kind] || items[0].label}</span>
                  <Badge variant="muted">{items.length}</Badge>
                </div>
                <ul className="divide-y divide-border/40">
                  {items.map((it) => (
                    <li key={`${it.kind}-${it.id}`} className="px-3 py-2 text-sm">
                      <p className="truncate text-foreground">
                        {it.name || <span className="text-muted-foreground">(adsız)</span>}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{it.id}</p>
                      {it.extra && (
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                          {Object.entries(it.extra)
                            .filter(([, v]) => v)
                            .map(([k, v]) => <span key={k}>{k}: {String(v)}</span>)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <Section title="Mail gönderimi" icon={Mail}>
        <Row label="Bildirim gönderildi mi">
          {mail?.notified
            ? <Badge variant="success">Evet</Badge>
            : <Badge variant="muted">Kayıt yok</Badge>}
        </Row>
        <Row label="Gönderim zamanı">{mail?.notifiedAt ? formatTrExact(mail.notifiedAt) : null}</Row>
        <Row label="Bildirim türü" mono>{mail?.kind}</Row>
        <Row label="Not">
          <span className="text-xs text-muted-foreground">{mail?.note}</span>
        </Row>
      </Section>

      <Section title="Erişim sayaçları">
        <Row label="Kullanım sayacı">{f.usageCount ?? 0}</Row>
        <Row label="Son erişim">{f.lastAccessedAt ? formatTrExact(f.lastAccessedAt) : '—'}</Row>
        <Row label="Alan (space)" mono>{f.spaceId}</Row>
        <Row label="Koleksiyon" mono>{f.collectionId}</Row>
        <Row label="Galeri" mono>{f.galleryId}</Row>
      </Section>
    </div>
  );
}

/** Güvenlik sekmesi: virüs taraması, karantina, ayrıştırma. */
function SecurityTab({ data, f }) {
  const scan = data.scan;
  const meta = SCAN_META[scan?.status] ?? SCAN_META.pending;
  const ScanIcon = scan?.infected ? ShieldAlert : scan?.clean ? ShieldCheck : Shield;

  return (
    <div className="space-y-5">
      {scan?.infected && (
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4" /> Bu dosyada virüs tespit edildi
          </AlertTitle>
          <AlertDescription>
            İmza: {scan.signature || 'bilinmiyor'} — dosya erişime kapatılmalı.
          </AlertDescription>
        </Alert>
      )}
      {scan?.quarantined && !scan?.infected && (
        <Alert variant="warning">
          <AlertTitle>Dosya karantinada</AlertTitle>
          <AlertDescription>
            Depolama aşaması “{scan.storageStage}”, işleme durumu “{scan.processingStatus}”.
            Tarama veya ayrıştırma tamamlanmadan dosya kullanıma açılmaz.
          </AlertDescription>
        </Alert>
      )}

      <Section
        title="Virüs taraması"
        icon={ScanIcon}
        tone={scan?.infected ? 'text-destructive' : scan?.clean ? 'text-green-600' : 'text-amber-600'}
      >
        <Row label="Sonuç"><Badge variant={meta.badge}>{meta.label}</Badge></Row>
        <Row label="Tarama motoru" mono>{scan?.engine}</Row>
        <Row label="Tarama zamanı">{scan?.scannedAt ? formatTrExact(scan.scannedAt) : null}</Row>
        <Row label="İmza" mono>{scan?.signature}</Row>
        <Row label="Hata">{scan?.error}</Row>
        {!scan?.scannedAt && (
          <Row label="Not">
            <span className="text-xs text-muted-foreground">
              Tarama kaydı yok. Üretilen dosyalar (AI çıktıları) tarama hattından geçmez;
              kullanıcı yüklemeleri karantinada taranır.
            </span>
          </Row>
        )}
      </Section>

      <Section title="İşleme durumu">
        <Row label="İşleme">{PROCESSING_LABEL[f.processingStatus] || f.processingStatus}</Row>
        <Row label="Depolama aşaması" mono>{scan?.storageStage}</Row>
        <Row label="Kayıt durumu">{f.status}</Row>
        <Row label="Checksum" mono>{f.checksum}</Row>
      </Section>

      <Section title="Ayrıştırma">
        <Row label="Ayrıştırıcı" mono>{scan?.parse?.parser}</Row>
        <Row label="Metin uzunluğu">
          {scan?.parse?.textLength ? `${scan.parse.textLength.toLocaleString('tr-TR')} karakter` : null}
        </Row>
        <Row label="Sayfa / sayfa sayısı">
          {[
            scan?.parse?.pageCount && `${scan.parse.pageCount} sayfa`,
            scan?.parse?.sheetCount && `${scan.parse.sheetCount} çalışma sayfası`,
            scan?.parse?.slideCount && `${scan.parse.slideCount} slayt`,
          ].filter(Boolean).join(' · ') || null}
        </Row>
        <Row label="Ayrıştırma zamanı">
          {scan?.parse?.parsedAt ? formatTrExact(scan.parse.parsedAt) : null}
        </Row>
        <Row label="Uyarılar">
          {scan?.parse?.warnings?.length ? (
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="size-3.5" />
              {scan.parse.warnings.join(', ')}
            </span>
          ) : null}
        </Row>
      </Section>

      <Section title="Depolama">
        <Row label="Bucket" mono>{f.bucket}</Row>
        <Row label="Yol" mono>{f.path}</Row>
        <Row label="Boyut">{formatBytes(f.sizeBytes)}</Row>
        <Row label="MIME" mono>{f.mimeType}</Row>
        <Row label="Uzantı" mono>{f.extension}</Row>
        <Row label="Etiketler">{f.tags?.length ? f.tags.join(', ') : null}</Row>
      </Section>
    </div>
  );
}

/** Dosya detayı: içerik önizlemesi + tam denetim künyesi (cms:admin). */
export function FileDetailSheet({ fileId, open, onOpenChange }) {
  const { data, isFetching, isError, error } = useGetFileContentQuery(fileId, {
    skip: !fileId || !open,
  });
  // components/ui/tabs KONTROLLÜ bir bileşen: iç state'i yok, `defaultValue`
  // yalnız ilk değeri verir ve `onValueChange` olmadan tıklama hiçbir şey
  // yapmaz. Seçili sekmeyi burada tutmak ZORUNLU.
  const [tab, setTab] = useState('preview');

  const f = data?.file;
  const source = SOURCE_META[f?.sourceGroup] ?? SOURCE_META.media;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="pe-8">
          <SheetTitle className="truncate">{f?.name || 'Dosya detayı'}</SheetTitle>
          <SheetDescription className="truncate">{f?.originalName || ''}</SheetDescription>
        </SheetHeader>

        {isError ? (
          // Hatanın ham sebebi GÖSTERİLİR: bu panel API'nin yeni bir ucuna
          // (/files/cms/:id/content) bağlı; backend deploy'u geride kaldığında
          // 404 döner. Sade "alınamadı" mesajı bunu dosya/parse hatasından
          // ayırt edilemez kılıyordu.
          <Alert variant="destructive">
            <AlertTitle>Dosya detayı alınamadı</AlertTitle>
            <AlertDescription>
              {error?.status === 404
                ? 'Uç nokta bulunamadı (404) — API bu sürümü henüz sunmuyor olabilir.'
                : error?.normalizedMessage || 'Bilinmeyen hata.'}
              {error?.status ? ` [HTTP ${error.status}]` : ''}
            </AlertDescription>
          </Alert>
        ) : isFetching || !f ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={source.badge}>{source.label}</Badge>
              <Badge variant="muted">{f.mediaType}</Badge>
              <Badge variant="outline">
                {PROCESSING_LABEL[f.processingStatus] || f.processingStatus}
              </Badge>
              {data.scan?.infected && <Badge variant="destructive">VİRÜSLÜ</Badge>}
              {data.scan?.clean && <Badge variant="success">Tarama temiz</Badge>}
              {data.aiTrail?.generated && <Badge variant="warning">AI üretimi</Badge>}
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="preview">İçerik</TabsTrigger>
                <TabsTrigger value="source">Kaynak</TabsTrigger>
                <TabsTrigger value="usage">
                  Kullanım{data.usage?.total ? ` (${data.usage.total})` : ''}
                </TabsTrigger>
                <TabsTrigger value="security">Güvenlik</TabsTrigger>
              </TabsList>

              <TabsContent value="preview"><PreviewTab data={data} f={f} /></TabsContent>
              <TabsContent value="source"><SourceTab data={data} f={f} /></TabsContent>
              <TabsContent value="usage"><UsageTab data={data} f={f} /></TabsContent>
              <TabsContent value="security"><SecurityTab data={data} f={f} /></TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default FileDetailSheet;
