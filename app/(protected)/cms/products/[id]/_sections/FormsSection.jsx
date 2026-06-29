'use client';

import { useState } from 'react';
import {
  FileText,
  Link2,
  Loader2,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  useAssociateCmsProductFormMutation,
  useCreateCmsProductFormMutation,
  useGenerateCmsProductFormMutation,
  useGetCmsProductFormsQuery,
} from '@/redux/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formSlotMeta } from '../../_data';

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Metin' },
  { value: 'textarea', label: 'Uzun Metin' },
  { value: 'number', label: 'Sayı' },
  { value: 'email', label: 'E-posta' },
  { value: 'phone', label: 'Telefon' },
  { value: 'date', label: 'Tarih' },
  { value: 'dropdown', label: 'Açılır Liste' },
  { value: 'checkbox', label: 'Onay Kutusu' },
  { value: 'radio', label: 'Seçenek' },
  { value: 'file', label: 'Dosya' },
];

function mutationMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.normalizedMessage ||
    error?.message ||
    fallback
  );
}

/** product[slot] populate edilmemiş olabilir (ObjectId string) — kısa gösterim. */
function linkedFormLabel(value) {
  if (!value) return null;
  if (typeof value === 'object') return value.formName || value._id || 'Bağlı';
  return `…${String(value).slice(-6)}`;
}

function SlotRow({ slot, product, onGenerate, onPick }) {
  const meta = formSlotMeta[slot];
  const linked = linkedFormLabel(product?.[slot]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">{meta.label}</p>
          <p className="text-xs text-muted-foreground">
            {linked ? (
              <>
                Bağlı form: <span className="font-mono">{linked}</span>
              </>
            ) : (
              'Form bağlı değil'
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onGenerate(slot)}>
          <Sparkles className="size-4" />
          Yapay zeka ile oluştur
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPick(slot)}>
          <Link2 className="size-4" />
          Mevcut formu seç
        </Button>
      </div>
    </div>
  );
}

export default function FormsSection({ product, onNotice }) {
  const id = product?._id || product?.id;

  // Üretim (AI) dialog state
  const [genSlot, setGenSlot] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState([]);

  // Seçim (picker) dialog state
  const [pickSlot, setPickSlot] = useState(null);
  const [selectedFormId, setSelectedFormId] = useState('');

  const [generateForm, { isLoading: generating }] =
    useGenerateCmsProductFormMutation();
  const [createForm, { isLoading: creating }] =
    useCreateCmsProductFormMutation();
  const [associateForm, { isLoading: associating }] =
    useAssociateCmsProductFormMutation();

  const pickerType = pickSlot ? formSlotMeta[pickSlot].type : undefined;
  const { data: forms = [], isFetching: loadingForms } =
    useGetCmsProductFormsQuery(
      { id, type: pickerType },
      { skip: !pickSlot },
    );

  const openGenerate = (slot) => {
    setGenSlot(slot);
    setPrompt('');
    setFormName('');
    setFields([]);
  };
  const closeGenerate = () => {
    if (!generating && !creating) setGenSlot(null);
  };

  const openPicker = (slot) => {
    setPickSlot(slot);
    setSelectedFormId('');
  };
  const closePicker = () => {
    if (!associating) setPickSlot(null);
  };

  const setFieldAt = (index, patch) =>
    setFields((cur) =>
      cur.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  const removeFieldAt = (index) =>
    setFields((cur) => cur.filter((_, i) => i !== index));

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      onNotice?.({
        variant: 'destructive',
        title: 'Açıklama gerekli',
        description: 'Form için bir açıklama (prompt) girin.',
      });
      return;
    }
    try {
      const result = await generateForm({
        id,
        prompt: prompt.trim(),
        formName: formName.trim() || undefined,
      }).unwrap();
      setFields(Array.isArray(result?.fields) ? result.fields : []);
      if (!formName.trim() && result?.formName) setFormName(result.formName);
      if (!result?.fields?.length) {
        onNotice?.({
          variant: 'warning',
          title: 'Alan üretilemedi',
          description: 'Yapay zeka uygun form alanı öneremedi, açıklamayı netleştirin.',
        });
      }
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Üretim başarısız',
        description: mutationMessage(err, 'Form alanları üretilemedi.'),
      });
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      onNotice?.({
        variant: 'destructive',
        title: 'Form adı gerekli',
        description: 'Kaydetmek için bir form adı girin.',
      });
      return;
    }
    if (!fields.length) {
      onNotice?.({
        variant: 'destructive',
        title: 'Alan gerekli',
        description: 'En az bir form alanı olmalı.',
      });
      return;
    }
    try {
      await createForm({
        id,
        slot: genSlot,
        formName: formName.trim(),
        fields,
      }).unwrap();
      setGenSlot(null);
      onNotice?.({
        variant: 'info',
        title: 'Form oluşturuldu',
        description: `${formSlotMeta[genSlot].label} oluşturuldu ve ilişkilendirildi.`,
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Kaydetme başarısız',
        description: mutationMessage(err, 'Form oluşturulamadı.'),
      });
    }
  };

  const handleAssociate = async () => {
    if (!selectedFormId) return;
    try {
      await associateForm({
        id,
        slot: pickSlot,
        formId: selectedFormId,
      }).unwrap();
      setPickSlot(null);
      onNotice?.({
        variant: 'info',
        title: 'Form ilişkilendirildi',
        description: `${formSlotMeta[pickSlot].label} güncellendi.`,
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'İşlem başarısız',
        description: mutationMessage(err, 'Form ilişkilendirilemedi.'),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formlar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        <SlotRow
          slot="requestForm"
          product={product}
          onGenerate={openGenerate}
          onPick={openPicker}
        />
        <SlotRow
          slot="productForm"
          product={product}
          onGenerate={openGenerate}
          onPick={openPicker}
        />
      </CardContent>

      {/* AI üretim + gözden geçirme dialog */}
      <Dialog open={!!genSlot} onOpenChange={(next) => !next && closeGenerate()}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <div className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>
                {genSlot ? formSlotMeta[genSlot].label : 'Form'} — Yapay Zeka ile Oluştur
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Form Adı
                </span>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Örn. Teklif Talep Formu"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Açıklama (prompt)
                </span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="Bu form hangi bilgileri toplamalı? Örn. müşteri adı, proje detayı, bütçe…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                />
              </label>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Alanları Üret
                </Button>
              </div>

              {fields.length > 0 && (
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Üretilen Alanlar ({fields.length}) — gözden geçirip düzenleyin
                  </p>
                  {fields.map((field, index) => (
                    <div
                      key={field.uuid || index}
                      className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_160px_auto]"
                    >
                      <div className="space-y-2">
                        <Input
                          value={field.label || ''}
                          onChange={(e) =>
                            setFieldAt(index, { label: e.target.value })
                          }
                          placeholder="Alan etiketi"
                        />
                        <Input
                          value={field.placeholder || ''}
                          onChange={(e) =>
                            setFieldAt(index, { placeholder: e.target.value })
                          }
                          placeholder="Placeholder (opsiyonel)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Select
                          value={field.type || 'text'}
                          onValueChange={(value) =>
                            setFieldAt(index, { type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tip" />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(field.required)}
                            onChange={(e) =>
                              setFieldAt(index, { required: e.target.checked })
                            }
                            className="size-4"
                          />
                          Zorunlu
                        </label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFieldAt(index)}
                        className="self-start text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGenSlot(null)}
                disabled={generating || creating}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={creating || !fields.length}
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Kaydet & İlişkilendir
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mevcut form seçim dialog */}
      <Dialog open={!!pickSlot} onOpenChange={(next) => !next && closePicker()}>
        <DialogContent className="max-h-[90vh] max-w-lg">
          <div className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>
                {pickSlot ? formSlotMeta[pickSlot].label : 'Form'} — Mevcut Form Seç
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {loadingForms ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : forms.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Bu firmaya ait uygun form bulunamadı.
                </p>
              ) : (
                forms.map((f) => {
                  const formId = f._id || f.id;
                  const active = selectedFormId === formId;
                  return (
                    <button
                      key={formId}
                      type="button"
                      onClick={() => setSelectedFormId(formId)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <span className="font-medium text-foreground">
                        {f.formName || 'İsimsiz form'}
                      </span>
                      <Badge variant="muted">
                        {f.fieldsCount ?? f.fields?.length ?? 0} alan
                      </Badge>
                    </button>
                  );
                })
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPickSlot(null)}
                disabled={associating}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                onClick={handleAssociate}
                disabled={associating || !selectedFormId}
              >
                {associating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                İlişkilendir
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
