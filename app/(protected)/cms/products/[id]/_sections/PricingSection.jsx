'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useUpdateCmsProductBasePriceMutation,
  useDeleteCmsProductBasePriceItemMutation,
} from '@/redux/services';
import { formatPrice, periodMeta, pricetypeMeta } from '../../_data';
import { mutationMessage, parseOptionalNumber } from '../../_form/productFormModel';

/**
 * basePrice (fiyat planları) editörü.
 *
 * SÖZLEŞME (productsController.js:10493 — updateProductBasePrice):
 * - PUT gövdesi `{ basePrice: [...] }` DEĞİL, dizinin/nesnenin KENDİSİ.
 * - Dizi gönderilirse tam plan seti olarak yorumlanır; eski planlar silinir.
 * - `pricetype` gövdeden TÜRETİLİR: birden çok plan veya `period` taşıyan plan
 *   → "recurring", aksi halde "fixed". Yani fiyat tipi buradan dolaylı değişir.
 * - Yazma sonrası backend `priceAmount`/`currency` alanlarını da resync eder,
 *   bu yüzden ürünün birim fiyatı plandan türetilmiş sayılır.
 *
 * SERVICE-ONLY KISIT: `recurring` yalnız firmanın businessMode==="service"
 * olduğu durumda kabul ediliyor; değilse buildBasePriceDocs 400 DÖNMEZ, sessizce
 * "fixed"e düşürür (:2464). Kullanıcıya bunu önceden söylüyoruz.
 */

const PERIOD_OPTIONS = [
  { value: '', label: 'Periyot yok (tek seferlik)' },
  ...Object.entries(periodMeta).map(([value, label]) => ({ value, label })),
];

const emptyPlan = () => ({
  key: `new-${Math.random().toString(36).slice(2, 9)}`,
  originalPrice: '',
  discountRate: '',
  currency: 'TRY',
  period: '',
  customLabel: '',
  isDefault: false,
});

const toRow = (bp, index) => ({
  key: bp?._id || `row-${index}`,
  priceId: bp?._id || null,
  originalPrice: bp?.originalPrice ?? '',
  discountRate: bp?.discountRate ?? '',
  currency: bp?.currency || 'TRY',
  period: bp?.period || '',
  customLabel: bp?.customLabel || '',
  isDefault: Boolean(bp?.isDefault),
});

export default function PricingSection({ product, onNotice }) {
  const basePrices = Array.isArray(product?.basePrice) ? product.basePrice : [];
  const productId = product?._id || product?.id;
  const businessMode = product?.companyid?.businessMode;

  const [rows, setRows] = useState(() => basePrices.map(toRow));
  const [editing, setEditing] = useState(false);

  const [updateBasePrice, { isLoading: saving }] =
    useUpdateCmsProductBasePriceMutation();
  const [deleteBasePriceItem, { isLoading: deleting }] =
    useDeleteCmsProductBasePriceItemMutation();

  // Ürün yeniden çekildiğinde (invalidate sonrası) formu tazele — düzenleme
  // açıkken ezmiyoruz ki kullanıcının girdisi kaybolmasın.
  useEffect(() => {
    if (!editing) setRows(basePrices.map(toRow));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const setRowField = (key, field, value) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );

  const setDefaultRow = (key) =>
    setRows((current) =>
      current.map((row) => ({ ...row, isDefault: row.key === key })),
    );

  // Kayıtta pricetype dizinin şeklinden türetilecek → kullanıcıya şimdiden göster.
  const willBeRecurring =
    rows.length > 1 || rows.some((row) => Boolean(row.period));
  const recurringBlocked = willBeRecurring && businessMode !== 'service';

  const handleSave = async () => {
    const payload = [];
    for (const row of rows) {
      const originalPrice = parseOptionalNumber(row.originalPrice);
      if (originalPrice === null || originalPrice < 0) {
        onNotice?.({
          variant: 'destructive',
          title: 'Fiyat geçersiz',
          description: 'Her planın liste fiyatı 0 veya daha büyük bir sayı olmalı.',
        });
        return;
      }
      const discountRate = parseOptionalNumber(row.discountRate) ?? 0;
      if (discountRate < 0 || discountRate > 100) {
        onNotice?.({
          variant: 'destructive',
          title: 'İndirim geçersiz',
          description: 'İndirim oranı 0 ile 100 arasında olmalı.',
        });
        return;
      }
      payload.push({
        originalPrice,
        discountRate,
        currency: String(row.currency || 'TRY').trim().toUpperCase(),
        // Boş period null gönderilir — model enum'unda null var, "" yok.
        period: row.period || null,
        ...(row.period === 'custom' && row.customLabel
          ? { customLabel: row.customLabel.trim() }
          : {}),
        isDefault: Boolean(row.isDefault),
      });
    }

    if (!payload.length) {
      onNotice?.({
        variant: 'destructive',
        title: 'Plan yok',
        description:
          'En az bir fiyat planı gerekli. Tüm planları kaldırmak için satırları tek tek silin.',
      });
      return;
    }

    // Hiçbiri varsayılan değilse ilkini işaretle — backend aksi halde kart/başlık
    // için ilk elemana düşer, davranışı burada açık hale getiriyoruz.
    if (!payload.some((p) => p.isDefault)) payload[0].isDefault = true;

    try {
      await updateBasePrice({ id: productId, basePrice: payload }).unwrap();
      setEditing(false);
      onNotice?.({
        variant: 'info',
        title: 'Fiyatlandırma kaydedildi',
        description: recurringBlocked
          ? 'Planlar kaydedildi. Firma hizmet modunda olmadığı için fiyat tipi "sabit" olarak uygulandı.'
          : `${payload.length} plan kaydedildi.`,
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Kaydedilemedi',
        description: mutationMessage(err, 'Fiyat planları kaydedilirken hata oluştu.'),
      });
    }
  };

  const handleDeleteRow = async (row) => {
    // Kaydedilmemiş satır → sadece formdan çıkar.
    if (!row.priceId) {
      setRows((current) => current.filter((r) => r.key !== row.key));
      return;
    }
    try {
      await deleteBasePriceItem({ id: productId, priceId: row.priceId }).unwrap();
      setRows((current) => current.filter((r) => r.key !== row.key));
      onNotice?.({
        variant: 'info',
        title: 'Plan silindi',
        description: 'Fiyat planı kaldırıldı.',
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Silinemedi',
        description: mutationMessage(err, 'Fiyat planı silinirken hata oluştu.'),
      });
    }
  };

  const pt = pricetypeMeta[
    product?.pricetype === 'rental' ? 'recurring' : product?.pricetype
  ];
  const busy = saving || deleting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiyatlandırma</CardTitle>
        <CardToolbar>
          <div className="flex items-center gap-2">
            <Badge variant="muted">{pt?.label ?? product?.pricetype}</Badge>
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRows(basePrices.map(toRow));
                    setEditing(false);
                  }}
                  disabled={busy}
                >
                  Vazgeç
                </Button>
                <Button size="sm" onClick={handleSave} disabled={busy}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Kaydet
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Düzenle
              </Button>
            )}
          </div>
        </CardToolbar>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {!editing ? (
          basePrices.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Wallet className="size-4" />
              Tanımlı fiyat planı yok — birim fiyat{' '}
              {formatPrice(product?.priceAmount, product?.currency)}.
            </div>
          ) : (
            <div className="space-y-2">
              {basePrices.map((bp, i) => (
                <div
                  key={bp._id || i}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {formatPrice(bp.originalPrice, bp.currency)}
                    </span>
                    {Number(bp.discountRate) > 0 && (
                      <Badge variant="warning">%{bp.discountRate}</Badge>
                    )}
                    {bp.discountedPrice != null &&
                      Number(bp.discountRate) > 0 && (
                        <span className="text-sm text-muted-foreground">
                          → {formatPrice(bp.discountedPrice, bp.currency)}
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    {bp.period && (
                      <Badge variant="secondary">
                        {bp.period === 'custom' && bp.customLabel
                          ? bp.customLabel
                          : periodMeta[bp.period] ?? bp.period}
                      </Badge>
                    )}
                    {bp.isDefault && <Badge variant="primary">Varsayılan</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {recurringBlocked && (
              <Alert variant="warning">
                <AlertDescription>
                  Birden fazla plan veya periyotlu plan “tekrarlı” fiyatlandırma
                  demektir, ama bu yalnız <strong>hizmet modundaki</strong>{' '}
                  firmalarda geçerli. Bu firma{' '}
                  <strong>{businessMode || 'bilinmiyor'}</strong> modunda —
                  kaydedilirse fiyat tipi sessizce <strong>sabit</strong>’e
                  düşürülür.
                </AlertDescription>
              </Alert>
            )}

            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Plan yok. “Plan ekle” ile başlayın.
              </p>
            )}

            {rows.map((row) => (
              <div
                key={row.key}
                className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Liste Fiyatı
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.originalPrice}
                    onChange={(e) =>
                      setRowField(row.key, 'originalPrice', e.target.value)
                    }
                    disabled={busy}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    İndirim (%)
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={row.discountRate}
                    onChange={(e) =>
                      setRowField(row.key, 'discountRate', e.target.value)
                    }
                    disabled={busy}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Para Birimi
                  </span>
                  <Input
                    value={row.currency}
                    onChange={(e) =>
                      setRowField(row.key, 'currency', e.target.value)
                    }
                    disabled={busy}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Periyot
                  </span>
                  <Select
                    value={row.period}
                    onValueChange={(value) =>
                      setRowField(row.key, 'period', value)
                    }
                    disabled={busy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Periyot" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value || 'none'} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {row.period === 'custom' && (
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Özel Periyot Etiketi
                    </span>
                    <Input
                      value={row.customLabel}
                      onChange={(e) =>
                        setRowField(row.key, 'customLabel', e.target.value)
                      }
                      placeholder="ör. 2 haftalık"
                      disabled={busy}
                    />
                  </label>
                )}

                <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="basePriceDefault"
                      checked={row.isDefault}
                      onChange={() => setDefaultRow(row.key)}
                      disabled={busy}
                      className="size-4"
                    />
                    Varsayılan plan (kartta gösterilir)
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRow(row)}
                    disabled={busy}
                  >
                    <Trash2 className="size-4 text-destructive" />
                    Kaldır
                  </Button>
                </div>
              </div>
            ))}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setRows((current) => [...current, emptyPlan()])}
              disabled={busy}
            >
              <Plus className="size-4" />
              Plan ekle
            </Button>

            <p className="text-xs text-muted-foreground">
              Kaydedildiğinde mevcut planların tamamı bu liste ile değiştirilir ve
              ürünün birim fiyatı varsayılan plandan yeniden hesaplanır.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
