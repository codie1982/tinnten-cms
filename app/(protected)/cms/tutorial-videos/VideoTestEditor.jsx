'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Captions, ChevronLeft, ChevronRight, FileAudio, Loader2, Play, RotateCcw, Save, Volume2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadTutorialVideoAsset } from '@/lib/tutorial-video-upload';

const parseTime = (value = '') => {
  const parts = value.trim().replace(',', '.').split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
};

const formatTime = (value = 0) => {
  const seconds = Math.max(0, Number(value) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${rest}`;
};

const displayTime = (value = 0) => {
  const seconds = Math.max(0, Number(value) || 0);
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

export function parseVtt(text = '') {
  const blocks = String(text).replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n{2,}/);
  return blocks.flatMap((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) return [];
    const [from, to] = lines[timingIndex].split('-->').map((part) => part.trim().split(/\s+/)[0]);
    const start = parseTime(from);
    const end = parseTime(to);
    const textLines = lines.slice(timingIndex + 1);
    if (start == null || end == null || !textLines.length) return [];
    return [{ start, end, text: textLines.join('\n') }];
  });
}

export function toVtt(cues = []) {
  const body = cues
    .filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.text?.trim())
    .map((cue) => `${formatTime(cue.start)} --> ${formatTime(cue.end)}\n${cue.text.trim()}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}${body ? '\n' : ''}`;
}

const selectedLocalization = (localizations, locale) =>
  localizations.find((item) => item.locale === locale) || { locale, audio: null, subtitle: null, audioOffsetSeconds: 0 };

/**
 * Kaynak videoyu, seçili dil sesini ve VTT altyazısını aynı zaman ekseninde
 * test eder. Video her zaman sessizdir; ses kaydı video zamanına/ofsetine göre
 * bu bileşen tarafından sürülür. Böylece çift ses veya native track farkı olmaz.
 */
export function VideoTestEditor({ video, localizations = [], tutorialVideoId, disabled, onLocalizationChange }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [locale, setLocale] = useState(() => localizations.find((item) => item.audio || item.subtitle)?.locale || localizations[0]?.locale || 'tr');
  const [time, setTime] = useState(0);
  const [subtitleText, setSubtitleText] = useState('WEBVTT\n\n');
  const [subtitleState, setSubtitleState] = useState('');
  const [savingSubtitle, setSavingSubtitle] = useState(false);

  const current = useMemo(() => selectedLocalization(localizations, locale), [localizations, locale]);
  const offset = Number(current.audioOffsetSeconds) || 0;
  const cues = useMemo(() => parseVtt(subtitleText), [subtitleText]);
  const activeCue = cues.find((cue) => time >= cue.start && time <= cue.end);

  useEffect(() => {
    if (!localizations.some((item) => item.locale === locale)) {
      setLocale(localizations.find((item) => item.audio || item.subtitle)?.locale || localizations[0]?.locale || 'tr');
    }
  }, [locale, localizations]);

  useEffect(() => {
    let cancelled = false;
    const subtitleUrl = current.subtitle?.url;
    if (!subtitleUrl) {
      setSubtitleText('WEBVTT\n\n');
      setSubtitleState('');
      return undefined;
    }
    setSubtitleState('Altyazı yükleniyor…');
    fetch(subtitleUrl)
      .then((response) => {
        if (!response.ok) throw new Error('Altyazı okunamadı.');
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setSubtitleText(text || 'WEBVTT\n\n');
          setSubtitleState('');
        }
      })
      .catch(() => {
        if (!cancelled) setSubtitleState('Altyazı dosyası okunamadı; metni buradan yeniden yazabilirsiniz.');
      });
    return () => { cancelled = true; };
  }, [current.subtitle?.url]);

  const syncAudio = useCallback((videoTime = videoRef.current?.currentTime || 0, playing = !videoRef.current?.paused) => {
    const audio = audioRef.current;
    if (!audio || !current.audio?.url) return;
    const expected = videoTime - offset;
    if (expected <= 0) {
      audio.pause();
      if (audio.currentTime !== 0) audio.currentTime = 0;
      return;
    }
    if (!Number.isFinite(audio.currentTime) || Math.abs(audio.currentTime - expected) > 0.2) {
      audio.currentTime = expected;
    }
    if (playing) audio.play().catch(() => {});
  }, [current.audio?.url, offset]);

  useEffect(() => {
    syncAudio();
  }, [syncAudio]);

  const updateOffset = (nextOffset) => {
    const value = Math.max(-36000, Math.min(36000, Number(nextOffset) || 0));
    onLocalizationChange(locale, { audioOffsetSeconds: value });
    syncAudio();
  };

  const seek = (nextTime) => {
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = Math.max(0, nextTime);
    setTime(player.currentTime);
    syncAudio(player.currentTime, !player.paused);
  };

  const saveSubtitle = async () => {
    if (!tutorialVideoId) return;
    setSavingSubtitle(true);
    setSubtitleState('');
    try {
      const file = new File([subtitleText || 'WEBVTT\n\n'], `${locale}-subtitles.vtt`, { type: 'text/vtt' });
      const asset = await uploadTutorialVideoAsset(file, { tutorialVideoId, assetType: 'subtitle', locale });
      onLocalizationChange(locale, { subtitle: asset });
      setSubtitleState('Altyazı dosyası yüklendi. Video ayarlarını ayrıca kaydedin.');
    } catch (error) {
      setSubtitleState(error?.message || 'Altyazı kaydedilemedi.');
    } finally {
      setSavingSubtitle(false);
    }
  };

  if (!video?.url) {
    return (
      <Alert variant="info">
        <AlertDescription>Test ortamını açmak için önce ekran kaydı videosunu yükleyin.</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-primary/25 bg-primary/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-sm font-semibold">Test ve düzenleme ortamı</h3><p className="text-xs text-muted-foreground">Ses senkronunu, altyazıyı ve içerik akışını yayınlamadan önce kontrol edin.</p></div>
        <Badge variant="outline">Canlı önizleme</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} src={video.url} muted controls playsInline className="aspect-video w-full"
              onPlay={(event) => syncAudio(event.currentTarget.currentTime, true)}
              onPause={() => audioRef.current?.pause()}
              onSeeking={(event) => syncAudio(event.currentTarget.currentTime, !event.currentTarget.paused)}
              onTimeUpdate={(event) => { setTime(event.currentTarget.currentTime); syncAudio(event.currentTarget.currentTime, !event.currentTarget.paused); }} />
            {activeCue?.text && <div className="pointer-events-none absolute inset-x-5 bottom-14 text-center"><span className="rounded bg-black/80 px-3 py-1.5 text-sm font-medium leading-6 text-white shadow-lg">{activeCue.text}</span></div>}
          </div>
          <audio ref={audioRef} src={current.audio?.url || undefined} preload="auto" />
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Oynatma: {displayTime(time)}</span><span>{current.audio ? `Ses: ${current.audio.fileName || 'yüklenmiş dosya'}` : 'Bu dil için ses yok'}</span></div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2"><FileAudio className="size-4 text-primary" /><p className="text-sm font-medium">Ses senkronu</p></div>
          <div className="grid grid-cols-2 gap-2">
            {localizations.map((item) => <Button key={item.locale} type="button" size="sm" variant={item.locale === locale ? 'default' : 'outline'} onClick={() => setLocale(item.locale)}>{item.locale.toUpperCase()} {item.audio ? '· Ses' : ''}</Button>)}
          </div>
          {!localizations.length && <p className="text-xs text-muted-foreground">Önce bir dil ses kaydı ekleyin.</p>}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2"><Volume2 className="size-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-xs">{current.audio?.fileName || 'Ses dosyası seçilmedi'}</span></div>
          <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Ses ofseti (sn)</span><Input type="number" step="0.1" min="-36000" max="36000" value={offset} disabled={disabled || !current.audio} onChange={(event) => updateOffset(event.target.value)} /></label>
          <div className="grid grid-cols-3 gap-2"><Button type="button" size="sm" variant="outline" disabled={disabled || !current.audio} onClick={() => updateOffset(offset - 0.5)}><ChevronLeft className="size-3.5" />0,5 sn</Button><Button type="button" size="sm" variant="outline" disabled={disabled || !current.audio} onClick={() => updateOffset(0)}><RotateCcw className="size-3.5" />Sıfırla</Button><Button type="button" size="sm" variant="outline" disabled={disabled || !current.audio} onClick={() => updateOffset(offset + 0.5)}>0,5 sn<ChevronRight className="size-3.5" /></Button></div>
          <p className="text-xs text-muted-foreground">Pozitif değer sesi geciktirir; negatif değer sesin daha erken başlamasını sağlar.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.6fr)]">
        <div className="space-y-2"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Captions className="size-4 text-primary" /><p className="text-sm font-medium">WebVTT altyazı düzenleyici · {locale.toUpperCase()}</p></div><Button type="button" size="sm" variant="outline" disabled={disabled || savingSubtitle || !tutorialVideoId} onClick={saveSubtitle}>{savingSubtitle ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}Altyazıyı yükle</Button></div><textarea value={subtitleText} onChange={(event) => setSubtitleText(event.target.value)} disabled={disabled} spellCheck="false" className="min-h-64 w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-ring/30" placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nİlk altyazı metni'} />{subtitleState && <p className="text-xs text-muted-foreground">{subtitleState}</p>}</div>
        <div className="space-y-2 rounded-xl border border-border bg-background p-3"><p className="text-sm font-medium">Altyazı zamanları</p><p className="text-xs text-muted-foreground">Satıra tıklayarak videoyu o ana sarın.</p><div className="max-h-64 space-y-1 overflow-auto">{cues.length ? cues.map((cue, index) => <button key={`${cue.start}-${index}`} type="button" onClick={() => seek(cue.start)} className="w-full rounded-md p-2 text-left text-xs hover:bg-muted"><span className="font-mono text-primary">{displayTime(cue.start)} – {displayTime(cue.end)}</span><span className="mt-1 block line-clamp-2 text-muted-foreground">{cue.text}</span></button>) : <p className="py-6 text-center text-xs text-muted-foreground">Geçerli bir WebVTT zaman satırı ekleyin.</p>}</div><Button type="button" size="sm" variant="outline" className="w-full" onClick={() => videoRef.current?.play()}><Play className="size-3.5" />Testi oynat</Button></div>
      </div>
    </section>
  );
}
