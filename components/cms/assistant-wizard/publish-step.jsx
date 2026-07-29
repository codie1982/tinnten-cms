'use client';

/**
 * Yayın & Güvenlik adımı — politika/konfigürasyon.
 *
 * Yayın SONRASI üretilen şeyler (public URL, API key, embed snippet) burada
 * YOKTUR; asistan oluştuktan sonra detay sayfasında görünür. Bu adım yalnızca
 * kaydedilecek ayarları toplar.
 *
 * `allowGlobalProductSearch` bilinçli olarak burada DEĞİL, ürün kapsamında —
 * iki ayrı kaynaktan yazılırsa hangisinin kazandığı belirsizleşir.
 */

import { Code2, Globe, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OUT_OF_SCOPE_BEHAVIORS, normalizeEmbedConfig } from '@/lib/assistant-capabilities';
import { ColorInput, Field, NumberInput, SegmentPicker, Textarea, ToggleRow } from './shared';

export function PublishStep({ w }) {
  const p = w.publish;
  const set = (patch) => w.set('publish', { ...p, ...patch });
  const embed = normalizeEmbedConfig(p.embed);
  const setEmbed = (patch) => set({ embed: normalizeEmbedConfig({ ...embed, ...patch }) });
  const setSafety = (patch) => set({ safety: { ...p.safety, ...patch } });

  return (
    <div className="space-y-5">
      <Alert variant="info">
        <AlertDescription>
          Asistan her zaman <span className="font-medium">taslak</span> olarak
          oluşturulur. Yayına alma işlemi firma tarafında sözleşme onayı ve yayın
          kotası kontrolünden geçer; buradaki ayarlar yayınlandığında geçerli olur.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2"><Globe className="size-4" />Tinnten Yayını</span>
          </CardTitle>
          <CardToolbar>
            <Badge variant={p.allowGuest ? 'success' : 'muted'}>
              {p.allowGuest ? 'Misafir açık' : 'Yalnız üye'}
            </Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <ToggleRow
            label="Misafir kullanıcılara izin ver"
            hint="Kapalıysa asistanla yalnızca giriş yapmış üyeler konuşabilir (audience: registered)."
            checked={p.allowGuest}
            onChange={(v) => set({ allowGuest: v })}
          />
          {p.allowGuest && (
            <Field label="Misafir Mesaj Limiti" hint="Giriş yapmamış kullanıcının konuşma başına mesaj hakkı.">
              <NumberInput value={p.guestMessageLimit} min={0} max={100} onChange={(v) => set({ guestMessageLimit: v })} className="max-w-[140px]" />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2"><Code2 className="size-4" />Embed Widget</span>
          </CardTitle>
          <CardToolbar>
            <Badge variant={embed.enabled ? 'success' : 'muted'}>{embed.enabled ? 'Açık' : 'Kapalı'}</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <ToggleRow
            label="Site içi widget'ı etkinleştir"
            hint="Script snippet'i ve API anahtarı, asistan oluşturulduktan sonra detay sayfasında görünür."
            checked={embed.enabled}
            onChange={(v) => setEmbed({ enabled: v })}
          />

          {embed.enabled && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Görünüm Biçimi">
                  <SegmentPicker
                    columns={2}
                    value={embed.display}
                    onChange={(v) => setEmbed({ display: v })}
                    options={[
                      { value: 'bubble', label: 'Balon', hint: 'Köşede yuvarlak buton' },
                      { value: 'drawer', label: 'Çekmece', hint: 'Kenardan açılan panel' },
                    ]}
                  />
                </Field>
                <Field label="Konum">
                  <SegmentPicker
                    columns={2}
                    value={embed.position}
                    onChange={(v) => setEmbed({ position: v })}
                    options={[
                      { value: 'bottom-right', label: 'Sağ alt' },
                      { value: 'bottom-left', label: 'Sol alt' },
                    ]}
                  />
                </Field>
                <Field label="Tema" className="sm:col-span-2">
                  <SegmentPicker
                    value={embed.theme}
                    onChange={(v) => setEmbed({ theme: v })}
                    options={[
                      { value: 'auto', label: 'Otomatik' },
                      { value: 'light', label: 'Açık' },
                      { value: 'dark', label: 'Koyu' },
                    ]}
                  />
                </Field>
              </div>

              <Field label="Renkler">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Buton rengi"><ColorInput value={embed.launcherColor} onChange={(v) => setEmbed({ launcherColor: v })} allowEmpty={false} /></Field>
                  <Field label="Buton ikon rengi"><ColorInput value={embed.launcherIconColor} onChange={(v) => setEmbed({ launcherIconColor: v })} allowEmpty={false} /></Field>
                  <Field label="Gövde arka planı"><ColorInput value={embed.bodyBackgroundColor} onChange={(v) => setEmbed({ bodyBackgroundColor: v })} /></Field>
                  <Field label="Gövde metni"><ColorInput value={embed.bodyTextColor} onChange={(v) => setEmbed({ bodyTextColor: v })} /></Field>
                  <Field label="Girdi arka planı"><ColorInput value={embed.inputBackgroundColor} onChange={(v) => setEmbed({ inputBackgroundColor: v })} /></Field>
                  <Field label="Girdi metni"><ColorInput value={embed.inputTextColor} onChange={(v) => setEmbed({ inputTextColor: v })} /></Field>
                  <Field label="Kullanıcı balonu"><ColorInput value={embed.userMessageBackgroundColor} onChange={(v) => setEmbed({ userMessageBackgroundColor: v })} /></Field>
                  <Field label="Kullanıcı balon metni"><ColorInput value={embed.userMessageTextColor} onChange={(v) => setEmbed({ userMessageTextColor: v })} /></Field>
                  <Field label="Asistan balonu"><ColorInput value={embed.assistantMessageBackgroundColor} onChange={(v) => setEmbed({ assistantMessageBackgroundColor: v })} /></Field>
                  <Field label="Asistan balon metni"><ColorInput value={embed.assistantMessageTextColor} onChange={(v) => setEmbed({ assistantMessageTextColor: v })} /></Field>
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Kullanıcı balonu yönü">
                  <SegmentPicker columns={2} value={embed.userMessageSide} onChange={(v) => setEmbed({ userMessageSide: v })}
                    options={[{ value: 'left', label: 'Sol' }, { value: 'right', label: 'Sağ' }]} />
                </Field>
                <Field label="Asistan balonu yönü">
                  <SegmentPicker columns={2} value={embed.assistantMessageSide} onChange={(v) => setEmbed({ assistantMessageSide: v })}
                    options={[{ value: 'left', label: 'Sol' }, { value: 'right', label: 'Sağ' }]} />
                </Field>
                <Field label="Balon köşe yarıçapı" hint="8–32 px.">
                  <NumberInput value={embed.messageRadius} min={8} max={32} onChange={(v) => setEmbed({ messageRadius: v })} />
                </Field>
              </div>

              <ToggleRow
                label="Sayfa bağlamını gönder"
                hint="Widget'ın bulunduğu sayfanın başlık/URL bilgisi asistana iletilir."
                checked={embed.pageContext}
                onChange={(v) => setEmbed({ pageContext: v })}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2"><Shield className="size-4" />Güvenlik</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <Field label="Kapsam Dışı Davranış" hint="Asistanın kapsamı dışındaki soruya nasıl karşılık vereceği.">
            <SegmentPicker
              options={OUT_OF_SCOPE_BEHAVIORS}
              value={p.safety.outOfScopeBehavior}
              onChange={(v) => setSafety({ outOfScopeBehavior: v })}
            />
          </Field>

          <ToggleRow
            label="Web'e düşmeye izin ver"
            hint="Kapsam içinde cevap bulunamazsa genel web araması yapılabilir."
            checked={p.safety.allowWebFallback}
            onChange={(v) => setSafety({ allowWebFallback: v })}
          />

          <Field label="Red Mesajı" hint="Kapsam dışı sorularda kullanılacak özel metin. Boş ise sistem varsayılanı.">
            <Textarea
              rows={3}
              value={p.refusalPrompt}
              onChange={(e) => set({ refusalPrompt: e.target.value })}
              placeholder="Bu konuda yardımcı olamıyorum. Ürünlerimiz hakkında soru sorabilirsiniz."
            />
          </Field>

          <Alert variant="info">
            <AlertDescription>
              Global ürün araması izni <span className="font-medium">Yetenekler → Ürün Arama</span>
              {' '}kartından yönetilir; burada ikinci bir kaynak tutulmaz.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

export default PublishStep;
