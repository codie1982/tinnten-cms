'use client';

/**
 * Intent adımı — intent → workflow binding.
 *
 * Tool ROUTING metinleri (Yetenekler adımındaki "LLM ile üret") ile KARIŞTIRMA:
 * orası tool'un ne zaman çağrılacağını anlatan metinleri üretir, burası ise
 * kullanıcı mesajının hangi iş akışını TETİKLEYECEĞİNİ tanımlar.
 *
 * Backend `intentDefinition` şeması `description` ve `workflowRefId` alanlarını
 * ZORUNLU tutar; ikisi de dolu olmayan tanımlar create payload'ında elenir.
 */

import { Plus, Target, Trash2, Workflow } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetWorkflowsQuery } from '@/redux/services';
import { INTENT_MODES } from '@/lib/assistant-capabilities';
import { Field, NumberInput, SegmentPicker, TagInput, Textarea, ToggleRow } from './shared';

export function IntentsStep({ w }) {
  const s = w.intentSettings;
  const setS = (patch) => w.set('intentSettings', { ...s, ...patch });
  const defs = w.intentDefinitions;

  const { data: wfData, isLoading: wfLoading } = useGetWorkflowsQuery(
    { limit: 100 },
    { skip: !s.enabled },
  );
  const workflows = wfData?.items ?? [];

  const addDef = () =>
    w.set('intentDefinitions', [
      ...defs,
      {
        id: `i_${Date.now()}`,
        label: '',
        description: '',
        examples: [],
        keywords: [],
        negativeExamples: [],
        workflowRefId: '',
        active: true,
        priority: 0,
        runOncePerConversation: false,
        cooldownSeconds: 0,
      },
    ]);

  const updateDef = (idx, patch) =>
    w.set('intentDefinitions', defs.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  const removeDef = (idx) => w.set('intentDefinitions', defs.filter((_, i) => i !== idx));

  const incomplete = defs.filter((d) => !d.description?.trim() || !d.workflowRefId).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Intent Ayarları</CardTitle>
          <CardToolbar>
            <Badge variant={s.enabled ? 'success' : 'muted'}>{s.enabled ? 'Açık' : 'Kapalı'}</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <ToggleRow
            label="Niyet algılama etkin"
            hint="Kullanıcı mesajları tanımlı intent'lerle eşleştirilip iş akışı tetiklenir."
            checked={s.enabled}
            onChange={(v) => setS({ enabled: v })}
          />
          {s.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Çözümleme Modu" className="sm:col-span-2">
                <SegmentPicker columns={2} options={INTENT_MODES} value={s.mode} onChange={(v) => setS({ mode: v })} />
              </Field>
              <Field label="Min. Güven" hint="0–1. Eşleşme bu değerin altındaysa tetiklenmez.">
                <NumberInput value={s.minConfidence} min={0} max={1} step={0.05} onChange={(v) => setS({ minConfidence: v })} />
              </Field>
              <Field label="Mesaj Başına Maks. Eşleşme" hint="1–5.">
                <NumberInput value={s.maxMatchesPerMessage} min={1} max={5} onChange={(v) => setS({ maxMatchesPerMessage: v })} />
              </Field>
              <div className="sm:col-span-2">
                <ToggleRow
                  label="Asenkron çalıştır"
                  hint="Kapalıysa iş akışı bitene kadar cevap bekletilir."
                  checked={s.runAsync}
                  onChange={(v) => setS({ runAsync: v })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {s.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Intent Tanımları</CardTitle>
            <CardToolbar>
              <Badge variant="muted">{defs.length} tanım</Badge>
              <Button size="sm" variant="outline" onClick={addDef}>
                <Plus className="size-3.5" />
                Intent Ekle
              </Button>
            </CardToolbar>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {incomplete > 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  {incomplete} tanımda açıklama veya iş akışı eksik — kayıtta bu tanımlar
                  atlanır.
                </AlertDescription>
              </Alert>
            )}

            {defs.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <Target className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Henüz intent tanımı yok. Asistan oluşturulduktan sonra da eklenebilir.
                </p>
              </div>
            ) : (
              defs.map((d, i) => (
                <div key={d.id} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <Field label="Etiket" hint="Yalnızca yönetim ekranı için.">
                        <Input value={d.label} onChange={(e) => updateDef(i, { label: e.target.value })} placeholder="Örn. Teklif talebi" />
                      </Field>
                      <Field label="İş Akışı" required>
                        <Select value={d.workflowRefId} onValueChange={(v) => updateDef(i, { workflowRefId: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder={wfLoading ? 'Yükleniyor…' : 'İş akışı seç'} />
                          </SelectTrigger>
                          <SelectContent>
                            {workflows.map((wf) => (
                              <SelectItem key={wf.id} value={wf.id}>
                                {wf.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Button variant="outline" size="icon" className="mt-5 size-9 shrink-0" onClick={() => removeDef(i)} title="Tanımı sil">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <Field label="Açıklama" required hint="LLM bu metinle niyeti tanır. Ne zaman tetiklenmeli?">
                    <Textarea rows={2} value={d.description} onChange={(e) => updateDef(i, { description: e.target.value })} placeholder="Kullanıcı fiyat teklifi istediğinde…" />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Örnek mesajlar" hint="En fazla 20.">
                      <TagInput value={d.examples} onChange={(v) => updateDef(i, { examples: v.slice(0, 20) })} placeholder="Teklif alabilir miyim?" />
                    </Field>
                    <Field label="Anahtar kelimeler" hint="En fazla 50.">
                      <TagInput value={d.keywords} onChange={(v) => updateDef(i, { keywords: v.slice(0, 50) })} placeholder="teklif" />
                    </Field>
                    <Field label="Negatif örnekler" hint="TetiklenMEmesi gereken mesajlar.">
                      <TagInput value={d.negativeExamples} onChange={(v) => updateDef(i, { negativeExamples: v.slice(0, 20) })} placeholder="Fiyat listeniz nedir?" />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Öncelik" hint="Yüksek olan önce denenir.">
                      <NumberInput value={d.priority} min={-100} max={100} onChange={(v) => updateDef(i, { priority: v })} />
                    </Field>
                    <Field label="Bekleme (sn)" hint="Aynı intent'in tekrar tetiklenme aralığı.">
                      <NumberInput value={d.cooldownSeconds} min={0} max={86400} onChange={(v) => updateDef(i, { cooldownSeconds: v })} />
                    </Field>
                    <div className="space-y-2">
                      <ToggleRow label="Aktif" checked={d.active} onChange={(v) => updateDef(i, { active: v })} />
                      <ToggleRow
                        label="Konuşmada bir kez"
                        checked={d.runOncePerConversation}
                        onChange={(v) => updateDef(i, { runOncePerConversation: v })}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            {workflows.length === 0 && !wfLoading && (
              <Alert variant="info">
                <AlertDescription>
                  <span className="inline-flex items-center gap-1.5">
                    <Workflow className="size-3.5" />
                    Listelenecek iş akışı bulunamadı — intent tanımı için önce bir iş akışı
                    yayınlanmalı.
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default IntentsStep;
