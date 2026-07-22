/**
 * Ürün / hizmet formunun TEK doğruluk kaynağı.
 *
 * Hem oluşturma sayfası (`../new/page.jsx`) hem düzenleme dialog'u
 * (`../[id]/page.jsx`) buradan besleniyor. Backend'in create ve update
 * sözleşmeleri BİRBİRİNDEN FARKLI; o farklar yalnızca bu dosyada yaşar,
 * bileşenlere sızmaz.
 *
 * Backend kaynakları (tinnten-server):
 * - create  → controller/productsController.js:5292 (addProduct)
 *             validators/product.validators.js:214 (validateAddProductRequest)
 * - update  → controller/productsCmsController.js:165 (buildCmsUpdatePatch)
 */

/* ── Yardımcılar ──────────────────────────────────────────────────────────── */

export function parseOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Kategori girdisini ID dizisine indirger.
 *
 * Backend `categories`'i ID olarak çözüyor (enrichCategoriesWithDetails,
 * productsController.js:400 — ObjectId/UUID regex'i). CategoryPicker zaten ID
 * tutar; bu fonksiyon dizi/serbest-metin karışık girdileri normalize eder ve
 * mevcut kayıtlardaki eski serbest-metin değerlerini bozmadan geçirir.
 */
export function splitCategories(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mutationMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.normalizedMessage ||
    error?.message ||
    fallback
  );
}

/**
 * 429 gövdesinden kota ayrıntısını çıkarır.
 *
 * baseQueryWithNormalize mesajı `normalizedMessage`'a indirir ama sayısal
 * yük `data.data` altında hayatta kalır (ApiResponse.error(429, msg, payload)).
 * Şekil: { limitType, usage, limit, remaining }.
 */
export function extractLimitPayload(error) {
  if (error?.status !== 429) return null;
  const payload = error?.data?.data;
  if (!payload || typeof payload !== 'object') return null;
  if (payload.limit === undefined && payload.usage === undefined) return null;
  return payload;
}

const trimmed = (value) => String(value ?? '').trim();

/* ── Hizmet tipi kuralları ────────────────────────────────────────────────── */

/**
 * `serviceType` → payload kuralları. Backend bu kısıtları 400 ile dayatıyor,
 * bu yüzden alanı UI'da GİZLEMEK YETMEZ — payload'dan tamamen çıkarılmalı:
 *
 * - hizmette dolu `stock`   → 400 serviceStockNotAllowed     (:5658)
 * - hizmette dolu `shipping`→ 400 serviceShipmentNotAllowed  (:5673)
 * - isOfferable + pozitif basePrice → 400 offerBasedServiceNeedsForm (:5688)
 *
 * `pricetype` backend'de `isOfferable`'dan türetiliyor (:5712) — isOfferable
 * tek doğruluk kaynağı, priceType yalnızca validator için gönderilir.
 */
export const SERVICE_TYPE_RULES = {
  slot: {
    isOfferable: false,
    priceType: 'fixed',
    allowBasePrice: true,
    enables: 'timeRestriction',
    hint: 'Zaman dilimli randevu. Çalışma saatleri ürün detayındaki Zamanlama bölümünden ayarlanır.',
  },
  rental: {
    isOfferable: false,
    priceType: 'fixed',
    allowBasePrice: true,
    enables: 'reservationConfig',
    hint: 'Rezervasyonlu kiralama. Süre/kapasite ayarları ürün detayındaki Zamanlama bölümünden yapılır.',
  },
  quote: {
    isOfferable: true,
    priceType: 'offer_based',
    allowBasePrice: false,
    enables: null,
    hint: 'Fiyat gösterilmez, müşteri teklif ister. Talep formunu ürün detayındaki Formlar bölümünden bağlayın.',
  },
  direct: {
    isOfferable: false,
    priceType: 'fixed',
    allowBasePrice: true,
    enables: null,
    hint: 'Sabit fiyatlı doğrudan satış. Tekrarlı (recurring) fiyatlandırmaya uygun tek hizmet tipi.',
  },
};

export const isServiceType = (type) => type === 'services' || type === 'service';

/* ── Form state ───────────────────────────────────────────────────────────── */

/**
 * Ürün dokümanını düz, string-anahtarlı form state'ine çevirir.
 * Nested `stock`/`shipping` düzleştirilir (stockStatus, shippingPriceMode, …).
 */
export function buildProductForm(product) {
  const firstRedirect = Array.isArray(product?.redirectUrl)
    ? product.redirectUrl[0] || ''
    : product?.redirectUrl || '';

  return {
    title: product?.title || '',
    shortTitle: product?.shortTitle || '',
    sku: product?.sku || '',
    brand: product?.brand || '',
    type: product?.type || 'product',
    serviceType: product?.serviceType || 'direct',
    status: product?.status || 'draft',
    pricetype: product?.pricetype || 'fixed',
    priceAmount: product?.priceAmount ?? '',
    currency: product?.currency || 'TRY',
    categories: Array.isArray(product?.categories) ? product.categories : [],
    meta: product?.meta || '',
    summary: product?.summary || '',
    description: product?.description || '',
    ctaLabel: product?.ctaLabel || '',
    redirectUrl: firstRedirect,
    coverImage: product?.coverImage || '',
    isOfferable: Boolean(product?.isOfferable),
    isLocationBased: Boolean(product?.isLocationBased),
    admin_aprove: product?.admin_aprove !== false,
    reason: product?.reason || '',
    notifyOwner: false,
    stockStatus: product?.stock?.status || 'in_stock',
    stockQuantity: product?.stock?.quantity ?? '',
    shippingShippable: product?.shipping?.shippable !== false,
    shippingPriceMode: product?.shipping?.priceMode || 'free',
    shippingPrice: product?.shipping?.price ?? '',
    shippingFreeOverAmount: product?.shipping?.freeOverAmount ?? '',
  };
}

/* ── Doğrulama ────────────────────────────────────────────────────────────── */

/**
 * Ortak alan doğrulaması. Hata varsa mesaj döner, yoksa null.
 * `requireSku` yalnız düzenlemede true — create'te SKU backend'de üretiliyor
 * (resolveSku, productsController.js:5503).
 */
export function validateProductForm(form, { requireSku = false } = {}) {
  const title = trimmed(form.title);
  if (!title || title.length < 2) return 'Başlık en az 2 karakter olmalı.';

  if (requireSku) {
    const sku = trimmed(form.sku);
    if (!sku || sku.length < 2) return 'SKU en az 2 karakter olmalı.';
  }

  // Backend yalnız https kabul ediyor; http kaydedilir ama public tarafta
  // sessizce düşerdi (sanitizePublicRedirectUrls).
  const redirectUrl = trimmed(form.redirectUrl);
  if (redirectUrl && !/^https:\/\//i.test(redirectUrl)) {
    return 'Yönlendirme bağlantısı https:// ile başlamalı.';
  }

  if (!form.admin_aprove && !trimmed(form.reason)) {
    return 'Admin ürünü/hizmeti durdururken reason alanı zorunludur.';
  }

  return null;
}

/* ── Payload serileştiriciler ─────────────────────────────────────────────── */

const buildBasePrice = (form) => {
  const originalPrice = parseOptionalNumber(form.priceAmount);
  if (originalPrice === null || originalPrice <= 0) return null;
  return {
    originalPrice,
    currency: trimmed(form.currency).toUpperCase() || 'TRY',
    discountRate: 0,
  };
};

/**
 * CREATE gövdesi. Alanları tipe göre DAHİL ETMEK yerine ÇIKARIR — backend
 * hizmette dolu stock/shipping, quote'ta pozitif fiyat gördüğünde 400 döner.
 */
export function toCreatePayload(form, companyId) {
  const isService = isServiceType(form.type);
  const rule = isService
    ? SERVICE_TYPE_RULES[form.serviceType] ?? SERVICE_TYPE_RULES.direct
    : null;

  const redirectUrl = trimmed(form.redirectUrl);

  const payload = {
    companyid: companyId,
    title: trimmed(form.title),
    // Boş string göndermek yerine alanı hiç göndermiyoruz — backend
    // `allow(null, "")` kabul etse de gereksiz alan yazmayalım.
    ...(trimmed(form.shortTitle) ? { shortTitle: trimmed(form.shortTitle) } : {}),
    ...(trimmed(form.meta) ? { meta: trimmed(form.meta) } : {}),
    ...(trimmed(form.summary) ? { summary: trimmed(form.summary) } : {}),
    ...(trimmed(form.description) ? { description: trimmed(form.description) } : {}),
    ...(trimmed(form.brand) ? { brand: trimmed(form.brand) } : {}),
    ...(trimmed(form.ctaLabel) ? { ctaLabel: trimmed(form.ctaLabel) } : {}),
    // create düz string alır; update dizi bekler (bkz. toPatchPayload).
    ...(redirectUrl ? { redirectUrl } : {}),
    ...(trimmed(form.coverImage) ? { coverImage: trimmed(form.coverImage) } : {}),
    categories: splitCategories(form.categories),
    type: isService ? 'services' : 'product',
    isLocationBased: Boolean(form.isLocationBased),
    status: 'draft',
  };

  if (isService) {
    payload.serviceType = form.serviceType;
    payload.isOfferable = rule.isOfferable;
    payload.priceType = rule.priceType;

    // stock / shipping BİLEREK yok — hizmette 400 sebebi.
    if (rule.allowBasePrice) {
      const basePrice = buildBasePrice(form);
      if (basePrice) payload.basePrice = basePrice;
    }
    if (rule.enables === 'timeRestriction') {
      payload.timeRestriction = { enabled: true };
    }
    if (rule.enables === 'reservationConfig') {
      payload.reservationConfig = { enabled: true };
    }
    return payload;
  }

  // ÜRÜN: catalogProduct:false ZORUNLU. Gönderilmezse backend katalog akışına
  // düşer ve attribute'ları zorunlu kılar (productsController.js:5342) — CMS'te
  // attribute editörü Faz 3'te geldiği için create 400 alırdı.
  payload.catalogProduct = false;
  payload.isOfferable = false;
  payload.priceType = form.pricetype === 'recurring' ? 'recurring' : 'fixed';

  const basePrice = buildBasePrice(form);
  if (basePrice) payload.basePrice = basePrice;

  payload.stock = {
    status: form.stockStatus,
    quantity: parseOptionalNumber(form.stockQuantity) ?? 0,
  };
  payload.shipping = {
    shippable: Boolean(form.shippingShippable),
    priceMode: form.shippingPriceMode,
    price: parseOptionalNumber(form.shippingPrice) ?? 0,
    freeOverAmount: parseOptionalNumber(form.shippingFreeOverAmount) ?? 0,
  };

  return payload;
}

/**
 * PATCH gövdesi (`/products/cms/:id`).
 *
 * `product` mevcut dokümandır; iki kural onu gerektiriyor:
 * 1. Tekrarlı ürünlerde `pricetype` GÖNDERİLMEZ — admin yanlışlıkla planı
 *    bozup fixed/offer_based'e çevirmesin. Eski 'rental' da tekrarlı sayılır.
 * 2. `basePrice` doluysa `priceAmount` türetilmiştir; PATCH ile yazmak
 *    basePrice'tan sapma üretir (updateProductBasePrice ters yönde resync
 *    ediyor, productsController.js:10518) — bu yüzden atlanır.
 */
export function toPatchPayload(form, product) {
  const isRecurring =
    product?.pricetype === 'recurring' || product?.pricetype === 'rental';
  const hasBasePrice =
    Array.isArray(product?.basePrice) && product.basePrice.length > 0;

  const payload = {
    title: trimmed(form.title),
    shortTitle: trimmed(form.shortTitle),
    sku: trimmed(form.sku),
    brand: trimmed(form.brand),
    type: isServiceType(form.type) ? 'services' : 'product',
    // Yalnız hizmette anlamlı — üründe gönderirsek modele alakasız bir enum
    // değeri damgalarız.
    ...(isServiceType(form.type) ? { serviceType: form.serviceType } : {}),
    status: form.status,
    currency: trimmed(form.currency).toUpperCase() || 'TRY',
    categories: splitCategories(form.categories),
    meta: trimmed(form.meta),
    summary: trimmed(form.summary),
    description: trimmed(form.description),
    ctaLabel: trimmed(form.ctaLabel),
    // update dizi bekler; temizleme YALNIZ [] ile olur ("" reddedilir).
    redirectUrl: trimmed(form.redirectUrl) ? [trimmed(form.redirectUrl)] : [],
    coverImage: trimmed(form.coverImage) || null,
    isOfferable: Boolean(form.isOfferable),
    isLocationBased: Boolean(form.isLocationBased),
    admin_aprove: form.admin_aprove,
    reason: trimmed(form.reason),
    notifyOwner: form.notifyOwner,
  };

  if (!isRecurring) payload.pricetype = form.pricetype;
  if (!hasBasePrice) payload.priceAmount = parseOptionalNumber(form.priceAmount);

  if (!isServiceType(form.type)) {
    payload.stock = {
      status: form.stockStatus,
      quantity: parseOptionalNumber(form.stockQuantity) ?? 0,
    };
    payload.shipping = {
      shippable: Boolean(form.shippingShippable),
      priceMode: form.shippingPriceMode,
      price: parseOptionalNumber(form.shippingPrice) ?? 0,
      freeOverAmount: parseOptionalNumber(form.shippingFreeOverAmount) ?? 0,
    };
  }

  return payload;
}
