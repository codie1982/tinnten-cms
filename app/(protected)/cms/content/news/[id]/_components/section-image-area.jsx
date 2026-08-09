'use client';

import { useState } from 'react';
import { Crosshair, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageDropArea, ImageSourcePicker } from './image-source-picker';

/**
 * Tek bir görsel alanı: önizleme + kaynak seçimi (yükle / URL / AI) + sunum
 * ayarları (en-boy, sığdırma, odak noktası). Kapak görselinde ve her bölüm
 * görselinde aynı bileşen kullanılır.
 */

const ASPECTS = [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', '1:1'], ['3/2', '3:2']];
const FITS = [['cover', 'Kırp'], ['contain', 'Sığdır'], ['fill', 'Ger']];
const clampPct = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function SectionImageArea({
  section,
  articleId,
  isCover,
  onUpdate,
  onSetCover,
  coverToggle = false,
  aiPromptSeed = '',
  emptyText = 'Bu bölümde görsel yok — sürükleyip bırakın, cihazdan yükleyin, URL verin veya AI ile üretin',
}) {
  const [replacing, setReplacing] = useState(false);
  const [focalMode, setFocalMode] = useState(false);
  const img = section.imageUrl;
  const fx = section.imageFocalX ?? 50;
  const fy = section.imageFocalY ?? 50;
  const aspect = section.imageAspect || '16/9';
  const fit = section.imageFit || 'cover';

  function onFocalClick(e) {
    if (!focalMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    onUpdate({
      imageFocalX: clampPct(((e.clientX - r.left) / r.width) * 100),
      imageFocalY: clampPct(((e.clientY - r.top) / r.height) * 100),
    });
  }

  return (
    <div className="space-y-2 border-b border-border bg-muted/20 p-3">
      {img ? (
        <>
          <div
            className={cn('relative overflow-hidden rounded-lg border border-border', focalMode && 'cursor-crosshair ring-2 ring-primary')}
            style={{ aspectRatio: aspect.replace('/', ' / ') }}
            onClick={onFocalClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={section.imageAlt || ''} className="h-full w-full" style={{ objectFit: fit, objectPosition: `${fx}% ${fy}%` }} />
            {isCover && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                <Star className="size-3" />Kapak
              </span>
            )}
            {/* Odak işaretçisi */}
            {focalMode && (
              <div
                className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)]"
                style={{ left: `${fx}%`, top: `${fy}%` }}
              />
            )}
            {!focalMode && (
              <div className="absolute bottom-2 right-2 flex gap-1.5">
                {coverToggle && (
                  isCover ? (
                    <Button size="sm" variant="default" className="h-7" onClick={() => onSetCover(null)} title="Bu görseli kapaktan kaldır">
                      <Star className="size-3.5 fill-current" />Kapağı kaldır
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 bg-background/90" onClick={() => onSetCover(section)} title="Bu görseli kapak yap">
                      <Star className="size-3.5" />Kapak yap
                    </Button>
                  )
                )}
                <Button size="sm" variant="outline" className="h-7 bg-background/90" onClick={() => setReplacing((v) => !v)}>Değiştir</Button>
                <Button size="sm" variant="outline" className="h-7 bg-background/90 text-destructive" onClick={() => { setReplacing(false); onUpdate({ imageUrl: '' }); }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Görseli değiştir — üç kaynak da burada */}
          {replacing && (
            <div className="rounded-lg border border-border bg-background p-2">
              <p className="mb-1.5 text-xs text-muted-foreground">Görseli değiştir:</p>
              <ImageSourcePicker
                articleId={articleId}
                aiPromptSeed={aiPromptSeed}
                onPicked={([url]) => { onUpdate({ imageUrl: url }); setReplacing(false); }}
              />
            </div>
          )}

          {/* En-boy + odak araç çubuğu */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">En-boy:</span>
            {ASPECTS.map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onUpdate({ imageAspect: val })}
                className={cn('rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                  aspect === val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground">Sığdır:</span>
            {FITS.map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onUpdate({ imageFit: val })}
                className={cn('rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                  fit === val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <Button size="sm" variant={focalMode ? 'default' : 'outline'} className="h-7" onClick={() => setFocalMode((v) => !v)}>
              <Crosshair className="size-3.5" />
              {focalMode ? `Odak: %${fx},%${fy} — Bitir` : 'Odak Ayarla'}
            </Button>
            {(fx !== 50 || fy !== 50) && (
              <Button size="sm" variant="ghost" className="h-7" onClick={() => onUpdate({ imageFocalX: 50, imageFocalY: 50 })}>Sıfırla</Button>
            )}
          </div>
          {focalMode && (
            <p className="text-xs text-muted-foreground">Görsele tıklayarak odak noktasını (kırpmada merkez) belirleyin.</p>
          )}
        </>
      ) : (
        <ImageDropArea
          articleId={articleId}
          aiPromptSeed={aiPromptSeed}
          text={emptyText}
          onPicked={([url]) => onUpdate({ imageUrl: url })}
        />
      )}
    </div>
  );
}
