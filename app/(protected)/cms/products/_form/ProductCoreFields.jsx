'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  typeOptions,
  statusOptions,
  priceTypeOptions,
  stockOptions,
  shippingPriceModeOptions,
  serviceTypeOptions,
} from '../_data';
import { CategoryPicker } from './CategoryPicker';
import { SERVICE_TYPE_RULES, isServiceType } from './productFormModel';

/**
 * Ürün / hizmet formunun ortak alan bloğu.
 *
 * Hem oluşturma sayfası hem düzenleme dialog'u bunu render eder — `mode` ile
 * ayrışırlar:
 * - create: SKU yok (backend üretir), durum yok (daima 'draft'), admin alanları yok
 * - edit:   hepsi var
 *
 * Alanların payload'a nasıl döneceği burada DEĞİL, productFormModel.js'te
 * (toCreatePayload / toPatchPayload) kararlaştırılır.
 */

const TEXTAREA_CLASS =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30';

function Field({ label, hint, className = '', children }) {
  return (
    <label className={`space-y-1.5 ${className}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function CheckboxField({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="size-4"
      />
      {label}
    </label>
  );
}

export function ProductCoreFields({
  form,
  setField,
  mode = 'edit',
  product = null,
  disabled = false,
}) {
  const isCreate = mode === 'create';
  const isService = isServiceType(form.type);
  const rule = isService
    ? SERVICE_TYPE_RULES[form.serviceType] ?? SERVICE_TYPE_RULES.direct
    : null;

  // Tekrarlı ürünlerde fiyat tipi kilitli — admin planı yanlışlıkla bozmasın.
  // toPatchPayload bu durumda `pricetype`'ı gövdeye HİÇ koymaz.
  const isRecurring =
    product?.pricetype === 'recurring' || product?.pricetype === 'rental';

  // Hizmette fiyat tipini serviceType belirler (isOfferable üzerinden backend
  // türetiyor) → kullanıcı seçemesin.
  const priceTypeLocked = disabled || isRecurring || (isCreate && isService);
  const effectivePriceType = isCreate && isService ? rule.priceType : form.pricetype;

  // Teklife bağlı hizmette pozitif fiyat 400 sebebi → alanı hiç gösterme.
  const showPriceAmount = !(isService && rule && !rule.allowBasePrice);

  // basePrice varken priceAmount türetilmiştir; PATCH ile yazmak sapma üretir.
  const basePriceCount = Array.isArray(product?.basePrice)
    ? product.basePrice.length
    : 0;
  const priceAmountDerived = !isCreate && basePriceCount > 0;

  return (
    <div className="space-y-5">
      {/* ── Tür ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tür">
          <Select
            value={isService ? 'services' : 'product'}
            onValueChange={(value) => setField('type', value)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tür" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions
                .filter((o) => o.value !== 'all')
                .map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>

        {isService && (
          <Field label="Hizmet Tipi" hint={rule?.hint}>
            <Select
              value={form.serviceType}
              onValueChange={(value) => setField('serviceType', value)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Hizmet tipi" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      {/* ── Temel bilgiler ──────────────────────────────────────────────── */}
      <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <Field label="Başlık" className="sm:col-span-2">
          <Input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field label="Kısa Başlık">
          <Input
            value={form.shortTitle}
            onChange={(e) => setField('shortTitle', e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field label="Marka">
          <Input
            value={form.brand}
            onChange={(e) => setField('brand', e.target.value)}
            disabled={disabled}
          />
        </Field>

        {!isCreate && (
          <Field label="SKU">
            <Input
              value={form.sku}
              onChange={(e) => setField('sku', e.target.value)}
              disabled={disabled}
            />
          </Field>
        )}
        {!isCreate && (
          <Field label="Durum">
            <Select
              value={form.status}
              onValueChange={(value) => setField('status', value)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions
                  .filter((o) => o.value !== 'all')
                  .map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Kategoriler" className="sm:col-span-2">
          <CategoryPicker
            value={form.categories}
            onChange={(ids) => setField('categories', ids)}
            disabled={disabled}
          />
        </Field>
      </div>

      {/* ── Fiyatlandırma ───────────────────────────────────────────────── */}
      <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <Field
          label="Fiyat Tipi"
          hint={
            isRecurring
              ? 'Tekrarlı ürünlerin fiyat tipi değiştirilemez.'
              : isCreate && isService
                ? 'Hizmet tipine göre otomatik belirlenir.'
                : undefined
          }
        >
          <Select
            value={effectivePriceType}
            onValueChange={(value) => setField('pricetype', value)}
            disabled={priceTypeLocked}
          >
            <SelectTrigger>
              <SelectValue placeholder="Fiyat tipi" />
            </SelectTrigger>
            <SelectContent>
              {priceTypeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {showPriceAmount && (
          <Field
            label="Birim Fiyat"
            hint={
              priceAmountDerived
                ? `${basePriceCount} fiyat planı tanımlı — birim fiyat plandan türetilir, buradan değiştirilemez.`
                : undefined
            }
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.priceAmount}
              onChange={(e) => setField('priceAmount', e.target.value)}
              disabled={disabled || priceAmountDerived}
            />
          </Field>
        )}

        <Field label="Para Birimi">
          <Input
            value={form.currency}
            onChange={(e) => setField('currency', e.target.value)}
            disabled={disabled}
          />
        </Field>
      </div>

      {/* ── İçerik & yönlendirme ────────────────────────────────────────── */}
      <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <Field label="Meta">
          <Input
            value={form.meta}
            onChange={(e) => setField('meta', e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field label="Kapak Görseli (URL)">
          <Input
            value={form.coverImage}
            onChange={(e) => setField('coverImage', e.target.value)}
            placeholder="https://…"
            disabled={disabled}
          />
        </Field>
        <Field label="CTA Buton Metni">
          <Input
            value={form.ctaLabel}
            onChange={(e) => setField('ctaLabel', e.target.value)}
            maxLength={40}
            disabled={disabled}
          />
        </Field>
        <Field label="Yönlendirme Linki" hint="https:// ile başlamalı.">
          <Input
            value={form.redirectUrl}
            onChange={(e) => setField('redirectUrl', e.target.value)}
            placeholder="https://…"
            disabled={disabled}
          />
        </Field>
        <Field label="Özet" className="sm:col-span-2">
          <textarea
            value={form.summary}
            onChange={(e) => setField('summary', e.target.value)}
            rows={3}
            disabled={disabled}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="Açıklama" className="sm:col-span-2">
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={5}
            disabled={disabled}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <div className="sm:col-span-2">
          <CheckboxField
            label="Konuma bağlı"
            checked={form.isLocationBased}
            onChange={(checked) => setField('isLocationBased', checked)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── Stok & kargo (yalnız ürün) ──────────────────────────────────── */}
      {/* Hizmette bu alanlar payload'dan TAMAMEN çıkarılır — backend dolu
          stock/shipping görürse 400 döner (productsController.js:5658). */}
      {!isService && (
        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <Field label="Stok Durumu">
            <Select
              value={form.stockStatus}
              onValueChange={(value) => setField('stockStatus', value)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Stok" />
              </SelectTrigger>
              <SelectContent>
                {stockOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Stok Miktarı">
            <Input
              type="number"
              min="0"
              step="1"
              value={form.stockQuantity}
              onChange={(e) => setField('stockQuantity', e.target.value)}
              disabled={disabled}
            />
          </Field>
          <Field label="Kargo Ücret Modeli">
            <Select
              value={form.shippingPriceMode}
              onValueChange={(value) => setField('shippingPriceMode', value)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kargo" />
              </SelectTrigger>
              <SelectContent>
                {shippingPriceModeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Kargo Ücreti">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.shippingPrice}
              onChange={(e) => setField('shippingPrice', e.target.value)}
              disabled={disabled}
            />
          </Field>
          <Field label="Ücretsiz Kargo Eşiği">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.shippingFreeOverAmount}
              onChange={(e) =>
                setField('shippingFreeOverAmount', e.target.value)
              }
              disabled={disabled}
            />
          </Field>
          <div className="self-end">
            <CheckboxField
              label="Kargoya uygun"
              checked={form.shippingShippable}
              onChange={(checked) => setField('shippingShippable', checked)}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* ── Admin kontrolü (yalnız düzenleme) ───────────────────────────── */}
      {!isCreate && (
        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <CheckboxField
            label="Admin onaylı"
            checked={form.admin_aprove}
            onChange={(checked) => setField('admin_aprove', checked)}
            disabled={disabled}
          />
          <CheckboxField
            label="Kaydedince kullanıcıya mail gönder"
            checked={form.notifyOwner}
            onChange={(checked) => setField('notifyOwner', checked)}
            disabled={disabled}
          />
          <Field
            label="Reason"
            className="sm:col-span-2"
            hint={
              !form.admin_aprove
                ? 'Admin onayı kapalıyken bu alan zorunludur.'
                : undefined
            }
          >
            <textarea
              value={form.reason}
              onChange={(e) => setField('reason', e.target.value)}
              rows={3}
              disabled={disabled}
              className={TEXTAREA_CLASS}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
