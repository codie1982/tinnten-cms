'use client';

/**
 * Profil / Prompt / Görünüm adımları.
 *
 * Profil ile Prompt ayrımı bilinçli ve backend sözleşmesinin parçası:
 *   Profil (title/description/tags) → liste + SEO metadata, conversation'a GİTMEZ.
 *   Prompt (asistan_name/systemPrompt/locale) → asistanın kimliği ve davranışı,
 *   her konuşmaya enjekte edilir.
 */

import { Plus, Trash2, MessageSquareText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LOCALES } from '@/lib/assistant-capabilities';
import { ColorInput, Field, SegmentPicker, TagInput, Textarea } from './shared';

/* ── Profil ─────────────────────────────────────────────────────────── */
export function ProfileStep({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardToolbar>
          <Badge variant="muted">Liste & SEO</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <Alert variant="info">
          <AlertDescription>
            Bu alanlar asistan listelerinde ve arama motorlarında görünür; konuşma
            bağlamına <span className="font-medium">enjekte edilmez</span>. Asistanın
            davranışını Prompt adımından tanımlayın.
          </AlertDescription>
        </Alert>
        <Field label="Başlık" hint="Sohbet ekranında ve listelerde görünen başlık.">
          <Input
            value={value.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Örn. Satış Danışmanı"
          />
        </Field>
        <Field label="Açıklama" hint="Asistanın ne yaptığına dair kısa tanıtım.">
          <Textarea
            rows={3}
            value={value.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Ürün önerisi ve satış sonrası destek sağlar…"
          />
        </Field>
        <Field label="Etiketler" hint="Keşif ve meta keywords için. Konuşmaya dahil edilmez.">
          <TagInput value={value.tags} onChange={(v) => set('tags', v)} placeholder="Etiket ekle…" />
        </Field>
      </CardContent>
    </Card>
  );
}

/* ── Prompt ─────────────────────────────────────────────────────────── */
export function PromptStep({ value, onChange, validation }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt & Kimlik</CardTitle>
        <CardToolbar>
          <Badge variant={validation.valid ? 'success' : 'warning'}>
            {validation.valid ? 'Geçerli' : 'Eksik'}
          </Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {!validation.valid && (
          <Alert variant="warning">
            <AlertDescription>{validation.errors.join(' ')}</AlertDescription>
          </Alert>
        )}
        <Field label="Asistan Adı" required hint="Konuşmada asistanın kendini tanıttığı ad.">
          <Input
            value={value.asistan_name}
            onChange={(e) => set('asistan_name', e.target.value)}
            placeholder="Örn. Deniz"
          />
        </Field>
        <Field label="Dil">
          <Select value={value.locale} onValueChange={(v) => set('locale', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Sistem Promptu"
          hint={`Her konuşmaya enjekte edilir. ${value.systemPrompt.length}/8000 karakter.`}
        >
          <Textarea
            rows={12}
            value={value.systemPrompt}
            onChange={(e) => set('systemPrompt', e.target.value)}
            placeholder={'Sen bir satış danışmanısın. Görevin…\n\nKurallar:\n- …'}
            className="font-mono text-xs"
          />
        </Field>
      </CardContent>
    </Card>
  );
}

/* ── Görünüm ────────────────────────────────────────────────────────── */
export function AppearanceStep({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const setTheme = (k, v) => onChange({ ...value, theme: { ...value.theme, [k]: v } });

  const addGroup = () =>
    set('suggestionGroups', [
      ...value.suggestionGroups,
      { id: `g_${Date.now()}`, label: '', icon: '', prompts: [] },
    ]);

  const updateGroup = (idx, patch) =>
    set(
      'suggestionGroups',
      value.suggestionGroups.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    );

  const removeGroup = (idx) =>
    set('suggestionGroups', value.suggestionGroups.filter((_, i) => i !== idx));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Karşılama & Girdi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Karşılama Başlığı" hint="Boş ise tema varsayılanı kullanılır.">
            <Input value={value.welcomeTitle} onChange={(e) => set('welcomeTitle', e.target.value)} placeholder="Merhaba! Nasıl yardımcı olabilirim?" />
          </Field>
          <Field label="Karşılama Alt Başlığı">
            <Input value={value.welcomeSubtitle} onChange={(e) => set('welcomeSubtitle', e.target.value)} placeholder="Ürünlerimiz hakkında sorabilirsiniz." />
          </Field>
          <Field label="Girdi Alanı Metni" className="sm:col-span-2">
            <Input value={value.inputPlaceholder} onChange={(e) => set('inputPlaceholder', e.target.value)} placeholder="Bir şeyler yazın…" />
          </Field>
          <Field label="Girdi Konumu">
            <SegmentPicker
              columns={2}
              value={value.inputPosition}
              onChange={(v) => set('inputPosition', v)}
              options={[
                { value: 'middle', label: 'Ortada', hint: 'Karşılama ekranı odaklı' },
                { value: 'bottom', label: 'Altta', hint: 'Klasik sohbet' },
              ]}
            />
          </Field>
          <Field label="Girdi Stili">
            <SegmentPicker
              columns={2}
              value={value.inputStyle}
              onChange={(v) => set('inputStyle', v)}
              options={[
                { value: 'simple', label: 'Sade', hint: 'Tek satır' },
                { value: 'rich', label: 'Zengin', hint: 'Araç çubuklu' },
              ]}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tema</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Tema Modu" className="sm:col-span-2">
            <SegmentPicker
              value={value.theme.mode}
              onChange={(v) => setTheme('mode', v)}
              options={[
                { value: 'auto', label: 'Otomatik', hint: 'Kullanıcı tercihi' },
                { value: 'light', label: 'Açık', hint: 'Zorunlu açık' },
                { value: 'dark', label: 'Koyu', hint: 'Zorunlu koyu' },
              ]}
            />
          </Field>
          <Field label="Ana Renk">
            <ColorInput value={value.theme.primaryColor} onChange={(v) => setTheme('primaryColor', v)} allowEmpty={false} />
          </Field>
          <Field label="Arka Plan" hint="Boş ise tema varsayılanı.">
            <ColorInput value={value.theme.backgroundColor} onChange={(v) => setTheme('backgroundColor', v)} />
          </Field>
          <Field label="Metin Rengi" hint="Boş ise tema varsayılanı.">
            <ColorInput value={value.theme.textColor} onChange={(v) => setTheme('textColor', v)} />
          </Field>
          <Field label="Yazı Tipi" hint="CSS font-family yığını.">
            <Input value={value.theme.fontFamily} onChange={(e) => setTheme('fontFamily', e.target.value)} placeholder="Inter, system-ui, sans-serif" />
          </Field>
          <Field label="Header İkon URL" hint="Boş ise firmanın logosu kullanılır." className="sm:col-span-2">
            <Input value={value.theme.headerIconUrl} onChange={(e) => setTheme('headerIconUrl', e.target.value)} placeholder="https://…/logo.png" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Öneri Grupları</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{value.suggestionGroups.length} grup</Badge>
            <Button size="sm" variant="outline" onClick={addGroup}>
              <Plus className="size-3.5" />
              Grup Ekle
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {value.suggestionGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <MessageSquareText className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Karşılama ekranındaki hazır soru grupları. Boş bırakılabilir.
              </p>
            </div>
          ) : (
            value.suggestionGroups.map((g, i) => (
              <div key={g.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <Field label="Grup Etiketi">
                      <Input value={g.label} onChange={(e) => updateGroup(i, { label: e.target.value })} placeholder="Örn. Fikir ver" />
                    </Field>
                    <Field label="İkon" hint="Lucide ikon adı veya URL.">
                      <Input value={g.icon} onChange={(e) => updateGroup(i, { icon: e.target.value })} placeholder="Sparkles" />
                    </Field>
                  </div>
                  <Button variant="outline" size="icon" className="mt-5 size-9 shrink-0" onClick={() => removeGroup(i)} title="Grubu sil">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <Field label="Sorular">
                  <TagInput
                    value={(g.prompts || []).map((p) => p.text)}
                    onChange={(texts) =>
                      updateGroup(i, {
                        prompts: texts.map((text, idx) => ({ id: `p_${i}_${idx}`, text })),
                      })
                    }
                    placeholder="Soru ekle…"
                  />
                </Field>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
