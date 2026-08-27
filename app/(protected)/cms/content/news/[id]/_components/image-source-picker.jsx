'use client';

import { useCallback, useRef, useState } from 'react';
import { ImageIcon, Link as LinkIcon, Loader2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadImagesAsUrls } from '@/lib/image-upload';
import { useGenerateNewsAiImageMutation } from '@/redux/services';

/**
 * Haber görselleri için üç kaynaklı ortak seçici: **cihazdan yükle**, **URL ver**,
 * **AI ile üret**. Kapak, zengin bölümler, düz bölümler ve HTML/Markdown
 * editörleri aynı bileşeni kullanır — böylece her içerik tipinde üç seçenek de
 * bulunur.
 *
 * Seçim sonucu `onPicked(urls)` ile düz URL dizisi olarak döner; nereye
 * yazılacağına (bölümün `imageUrl`'i mi, editöre `<img>` etiketi mi) çağıran
 * karar verir.
 *
 * AI üretimi kayıtlı bir habere bağlıdır (backend görseli `image/news-ai/:id/`
 * altına yazıp makaleye attach eder) — `articleId` yoksa AI butonu kilitlidir.
 */

/** Backend `ALLOWED_IMAGE_SIZES` ile birebir (newsContentController.js). */
const AI_SIZES = [
  ['1024x1024', 'Kare 1024'],
  ['512x512', 'Kare 512'],
  ['256x256', 'Kare 256'],
];

const IMAGE_MIME_BY_EXTENSION = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

// Bazı tarayıcı/işletim sistemi kombinasyonları JPG dosyalarında MIME bilgisini
// boş veya application/octet-stream döndürebiliyor. Bu durumda uzantıyı temel
// alıp yüklemeye devam ediyoruz; doğru MIME'ı FormData'ya aktarabilmek için de
// dosyayı gerektiğinde aynı içerikle yeniden oluşturuyoruz.
function normalizeImageFile(file) {
  if (!file) return null;

  const extension = file.name?.split('.').pop()?.toLowerCase();
  const mime = IMAGE_MIME_BY_EXTENSION[extension];
  if (mime && file.type !== mime) {
    return new File([file], file.name, { type: mime, lastModified: file.lastModified });
  }
  if (file.type?.startsWith('image/')) return file;
  if (!mime) return null;

  return file;
}

/** Dosya listesini yükleyip URL'e çeviren ortak durum makinesi. */
function useImageUpload({ multiple, onPicked }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).map(normalizeImageFile).filter(Boolean);
      if (!files.length) {
        setError('Yalnızca görsel dosyaları yüklenebilir.');
        return false;
      }
      setError('');
      setUploading(true);
      try {
        const { urls, failed } = await uploadImagesAsUrls(multiple ? files : [files[0]]);
        if (urls.length) onPicked(urls);
        if (failed.length) {
          setError(`${failed.length} dosya yüklenemedi: ${failed[0]?.error || 'bilinmeyen hata'}`);
        }
        return urls.length > 0;
      } catch (e) {
        setError(e?.message || 'Görsel yüklenemedi.');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [multiple, onPicked],
  );

  return { upload, uploading, error, setError };
}

export function ImageSourcePicker({
  articleId,
  onPicked,
  multiple = false,
  aiPromptSeed = '',
  className,
}) {
  const [genAiImage, { isLoading: generating }] = useGenerateNewsAiImageMutation();
  const [panel, setPanel] = useState(null); // null | 'url' | 'ai'
  const [urlVal, setUrlVal] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSize, setAiSize] = useState(AI_SIZES[0][0]);
  const [aiError, setAiError] = useState('');
  const fileRef = useRef(null);
  const { upload, uploading, error: uploadError, setError: setUploadError } = useImageUpload({
    multiple,
    onPicked,
  });

  const togglePanel = (key) => {
    setUploadError('');
    setAiError('');
    setPanel((p) => (p === key ? null : key));
  };

  function applyUrl() {
    const v = urlVal.trim();
    if (!v) return;
    onPicked([v]);
    setUrlVal('');
    setPanel(null);
  }

  async function generate() {
    const prompt = aiPrompt.trim();
    if (!prompt || !articleId) return;
    setAiError('');
    try {
      const r = await genAiImage({ id: articleId, prompt, size: aiSize }).unwrap();
      const url = r?.url;
      if (!url) {
        setAiError('Görsel üretildi ama URL alınamadı.');
        return;
      }
      onPicked([url]);
      setAiPrompt('');
      setPanel(null);
    } catch (e) {
      setAiError(e?.data?.message || e?.normalizedMessage || 'Görsel üretilemedi.');
    }
  }

  const err = uploadError || aiError;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.jpg,.jpeg"
          multiple={multiple}
          className="hidden"
          onChange={async (e) => {
            // FileList bazı tarayıcılarda input'a bağlı canlı bir nesnedir.
            // Input'u temizlemeden önce snapshot almazsak `upload()` boş liste
            // görür ve geçerli JPG/PNG dosyalarını da reddeder.
            const files = Array.from(e.target.files || []);
            // Aynı dosyanın tekrar seçilebilmesi için input'u sıfırla.
            e.target.value = '';
            if (await upload(files)) setPanel(null);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {uploading ? 'Yükleniyor…' : 'Yükle'}
        </Button>
        <Button
          size="sm"
          variant={panel === 'url' ? 'default' : 'outline'}
          className="h-7"
          onClick={() => togglePanel('url')}
        >
          <LinkIcon className="size-3.5" />
          URL
        </Button>
        <Button
          size="sm"
          variant={panel === 'ai' ? 'default' : 'outline'}
          className="h-7"
          disabled={!articleId}
          title={!articleId ? 'AI görsel için önce haberi kaydedin' : ''}
          onClick={() => {
            if (!aiPrompt && aiPromptSeed) setAiPrompt(aiPromptSeed.slice(0, 500));
            togglePanel('ai');
          }}
        >
          <Sparkles className="size-3.5" />
          AI
        </Button>
      </div>

      {panel === 'url' && (
        <div className="flex gap-2">
          <input
            value={urlVal}
            autoFocus
            onChange={(e) => setUrlVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyUrl(); }}
            placeholder="https://… görsel URL'i"
            className="h-8 flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/30"
          />
          <Button size="sm" className="h-8" onClick={applyUrl} disabled={!urlVal.trim()}>Uygula</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setPanel(null)}>İptal</Button>
        </div>
      )}

      {panel === 'ai' && (
        <div className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2">
          <textarea
            value={aiPrompt}
            autoFocus
            onChange={(e) => setAiPrompt(e.target.value.slice(0, 500))}
            rows={2}
            placeholder="AI görsel istemi — örn. yapay zeka temalı modern haber görseli"
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/30"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-7" onClick={generate} disabled={generating || !aiPrompt.trim()}>
              {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {generating ? 'Üretiliyor…' : 'Üret'}
            </Button>
            <select
              value={aiSize}
              onChange={(e) => setAiSize(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
            >
              {AI_SIZES.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{aiPrompt.length}/500</span>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setPanel(null)} disabled={generating}>
              Vazgeç
            </Button>
          </div>
        </div>
      )}

      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

/**
 * Boş görsel alanı: sürükle-bırak kutusu + üç kaynaklı seçici. Kapak ve bölüm
 * görsellerinin boş durumunda "resim yükleme alanı" olarak kullanılır.
 */
export function ImageDropArea({
  articleId,
  onPicked,
  multiple = false,
  aiPromptSeed = '',
  text = 'Görseli buraya sürükleyin, cihazdan yükleyin, URL verin veya AI ile üretin',
  className,
}) {
  const [dragging, setDragging] = useState(false);
  const { upload, uploading, error } = useImageUpload({ multiple, onPicked });

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer?.files); }}
      className={cn(
        'space-y-2 rounded-lg border-2 border-dashed px-3 py-3 transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border',
        className,
      )}
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
        {uploading ? 'Yükleniyor…' : text}
      </span>
      <ImageSourcePicker
        articleId={articleId}
        onPicked={onPicked}
        multiple={multiple}
        aiPromptSeed={aiPromptSeed}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
