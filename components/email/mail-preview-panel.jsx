'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, Loader2, Monitor, Smartphone, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { addDemoRecipients, getDemoRecipients } from '@/lib/mail-demo-recipients';
import { usePreviewMailCampaignMutation } from '@/redux/services';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Kampanya mail önizlemesi — "önizlenen = gönderilen".
 *
 * Backend şablon + konu override + genel değişkenleri gönderim anındaki
 * header/footer (unsubscribe) chrome'u ile sarıp tam HTML döndürür; burada
 * izole bir iframe'de (sandbox + srcDoc) gösterilir — CMS CSS'i maile, mail
 * CSS'i sayfaya SIZMAZ (şablon editöründeki dangerouslySetInnerHTML'in aksine).
 * "Alıcı gözüyle": bir e-posta girilirse {{USER_NAME}} gibi token'lar o kişinin
 * GERÇEK verisiyle çözülür (backend resolveEmailVars — test-send ile aynı yol).
 */
export function MailPreviewPanel({ campaignId, open, onClose }) {
  const [preview, { isLoading }] = usePreviewMailCampaignMutation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [as, setAs] = useState('');
  const [mode, setMode] = useState('desktop'); // desktop | mobile
  const [savedRecipients, setSavedRecipients] = useState([]);

  const load = async (asEmail) => {
    setError('');
    const r = await preview({ id: campaignId, as: asEmail || undefined })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Önizleme alınamadı.' }));
    if (r?.__err) return setError(r.__err);
    setData(r);
    if (asEmail) setSavedRecipients(addDemoRecipients(asEmail));
  };

  useEffect(() => {
    if (open && campaignId) {
      setData(null);
      setError('');
      setAs('');
      setSavedRecipients(getDemoRecipients());
      load(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignId]);

  if (!open) return null;

  const loadAs = () => {
    const email = as.trim().toLowerCase();
    if (!email) return load(null);
    if (!EMAIL_RE.test(email)) return setError('Geçerli bir e-posta adresi girin.');
    load(email);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card className="flex max-h-[92vh] w-full max-w-4xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle><Eye className="mr-1 inline size-4" /> Önizleme · gönderilecek mail</CardTitle>
          <CardToolbar className="gap-2">
            <div className="flex rounded-md border border-border p-0.5">
              <Button
                variant={mode === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMode('desktop')}
                title="Masaüstü görünümü"
              >
                <Monitor className="size-3.5" /> Masaüstü
              </Button>
              <Button
                variant={mode === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMode('mobile')}
                title="Mobil görünümü (375px)"
              >
                <Smartphone className="size-3.5" /> Mobil
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {/* Alıcı gözüyle önizleme */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">
                Alıcı gözüyle (token'lar bu kişinin gerçek verisiyle çözülür; boş = örnek değerler)
              </label>
              <Input
                list="mail-preview-demo-recipients"
                placeholder="ornek@adres.com"
                value={as}
                onChange={(e) => setAs(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAs()}
              />
              <datalist id="mail-preview-demo-recipients">
                {savedRecipients.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
            <Button variant="outline" onClick={loadAs} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
              Bu gözle önizle
            </Button>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {!data && !error ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : data ? (
            <>
              {/* Mail başlık şeridi — gerçek gönderim değerleri */}
              <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="flex gap-2">
                  <span className="w-16 shrink-0 text-muted-foreground">Kimden</span>
                  <span className="min-w-0 truncate font-medium">{data.from}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 shrink-0 text-muted-foreground">Kime</span>
                  <span className="min-w-0 truncate">
                    {data.to}
                    {data.sampleRecipient && (
                      <span className="ml-2 text-xs text-muted-foreground">(örnek alıcı)</span>
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 shrink-0 text-muted-foreground">Konu</span>
                  <span className="min-w-0 font-medium">{data.subject}</span>
                </div>
              </div>

              {data.unresolved?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <AlertTriangle className="size-3.5 text-amber-600" />
                  <span className="text-amber-700 dark:text-amber-400">Çözülemeyen token'lar:</span>
                  {data.unresolved.map((t) => (
                    <Badge key={t} variant="warning" className="font-mono">{`{{${t}}}`}</Badge>
                  ))}
                </div>
              )}

              {/* İzole önizleme — sayfa CSS'i sızmaz */}
              <div className={mode === 'mobile' ? 'mx-auto w-[375px] max-w-full' : 'w-full'}>
                <iframe
                  title="kampanya-mail-onizleme"
                  srcDoc={data.html}
                  className="h-[62vh] w-full rounded-lg border border-border bg-white"
                  sandbox=""
                />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
