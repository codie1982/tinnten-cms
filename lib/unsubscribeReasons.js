/**
 * Abonelikten çıkma gerekçe kategorileri — SUNUM katmanı (etiket + renk).
 *
 * Kategorilerin ANLAMI backend'de tanımlı (tinnten-server
 * `src/domains/mail-list/unsubscribeReasons.js`); burada yalnız CMS'in
 * göstereceği Türkçe etiket + grafik/rozet rengi tutulur. Backend stats yanıtı
 * her çıkışa `category` alanı koyar; bu tablo o kategoriyi renklendirir.
 *
 * Renk seçimi bilinçli: kendi çıkışı NÖTR (kullanıcı hakkı, sorun değil),
 * teslimat sorunu KIRMIZI (itibar riski), liste temizliği MOR (bizim koruma),
 * elle çıkarma MAVİ (operatör aksiyonu).
 */

export const UNSUB_CATEGORY_META = {
  self: {
    label: 'Kendi ayrıldı',
    hint: 'Kişi mailden/hesabından abonelikten çıktı',
    color: '#f59e0b', // amber
    badge: 'muted',
  },
  operator: {
    label: 'Operatör çıkardı',
    hint: 'CMS’te editör tarafından listeden çıkarıldı veya engellendi',
    color: '#3b82f6', // blue
    badge: 'secondary',
  },
  cleanup: {
    label: 'Sistem eledi',
    hint: 'Gönderim öncesi doğrulama veya otomatik liste temizliği',
    color: '#8b5cf6', // violet
    badge: 'secondary',
  },
  delivery: {
    label: 'Teslimat sorunu',
    hint: 'Kalıcı bounce, spam şikâyeti veya Kara Liste',
    color: '#ef4444', // red
    badge: 'destructive',
  },
  other: {
    label: 'Diğer',
    hint: 'Sınıflandırılmamış gerekçe',
    color: '#94a3b8', // slate
    badge: 'muted',
  },
};

/** Grafik/legend'in sabit sırası. */
export const UNSUB_CATEGORY_ORDER = ['self', 'operator', 'cleanup', 'delivery', 'other'];

export const categoryMeta = (key) => UNSUB_CATEGORY_META[key] || UNSUB_CATEGORY_META.other;

/**
 * Backend `reasonInfo` gönderemediğinde kullanılan geçiş/fallback sözlüğü.
 * Asıl anlam kataloğu tinnten-server'dadır; bu tablo iki uygulama farklı
 * zamanlarda deploy edildiğinde ham kod göstermemek içindir.
 */
const REASON_FALLBACKS = {
  user_unsubscribed: ['self', 'recipient', 'Kendi ayrıldı', 'Abonelikten ayrıldı', 'Alıcının abonelikten çıkma talebiyle gönderimler durduruldu.'],
  user_unsubscribed_all: ['self', 'recipient', 'Kendi ayrıldı', 'Tüm listelerden ayrıldı', 'Alıcı tüm e-posta aboneliklerini kendi tercihiyle kapattı.'],
  user_unsubscribed_via_email: ['self', 'recipient', 'Kendi ayrıldı', 'E-postadaki bağlantıdan ayrıldı', 'Alıcı, kendisine gönderilen e-postadaki abonelikten çıkma bağlantısını kullandı.'],
  user_unsubscribed_one_click: ['self', 'recipient', 'Kendi ayrıldı', 'Tek tıkla abonelikten ayrıldı', 'Alıcı veya e-posta sağlayıcısı tek-tıkla çıkış işlemini tamamladı.'],
  user_clicked_unsubscribe: ['self', 'recipient', 'Kendi ayrıldı', 'Çıkış bağlantısını kullandı', 'Alıcı abonelikten çıkma bağlantısına tıklayarak gönderimleri durdurdu.'],
  user_unsubscribed_via_reply: ['self', 'recipient', 'Kendi ayrıldı', 'Yanıtla çıkış talebi verdi', 'Alıcı e-postaya yanıt vererek çıkmak istedi; yanıt taraması bu talebi algıladı.'],
  one_click: ['self', 'recipient', 'Kendi ayrıldı', 'Tek tıkla abonelikten ayrıldı', 'Eski tek-tıkla çıkış akışından gelen alıcı talebiyle gönderimler durduruldu.'],
  cms_removed: ['operator', 'operator', 'Operatör çıkardı', "CMS'te listeden çıkarıldı", 'Adres CMS üzerinden bir operatör tarafından listeden çıkarıldı; alıcı kendi çıkmadı.'],
  manual: ['operator', 'operator', 'Operatör engelledi', 'Elle gönderim engeli eklendi', 'Adres bir operatör tarafından global Kara Listeye eklendi; alıcı kendi çıkmadı.'],
  mail_list_removed: ['operator', 'operator', 'Operatör çıkardı', 'Abone kaydı kaldırıldı', 'Abone kaydı kaldırma işlemi adresi gönderimden çıkardı; alıcı kendi çıkmadı.'],
  per_domain_cap: ['cleanup', 'system', 'Sistem eledi', 'Alan adı başına üst sınır', 'Aynı alan adından fazla sayıda adres bulunduğu için sistem liste temizliği sırasında bu adresi eledi.'],
  daily_recipient_cap: ['cleanup', 'system', 'Sistem atladı', 'Günlük alıcı sınırı', 'Bu adrese günlük gönderim sınırı dolduğu için ilgili gönderim yapılmadı; bu bir kullanıcı çıkışı değildir.'],
  wrong_recipient_risk: ['cleanup', 'system', 'Sistem eledi', 'Yanlış muhatap riski', 'Adresin basın veya iletişim hedefiyle uyuşmayan bir rol kutusu olma riski nedeniyle sistem eledi.'],
  moved_to_language_channel: ['cleanup', 'system', 'Sistem taşıdı', 'Dil listesine taşındı', 'Adres doğru dil segmentine taşınırken önceki liste üyeliği sistem tarafından kapatıldı.'],
  smtp_verify_no_mailbox: ['cleanup', 'system', 'Sistem eledi', 'Posta kutusu veya MX bulunamadı', 'Gönderim öncesi SMTP kontrolünde alan adında MX kaydı bulunamadı veya alıcı sunucusu posta kutusunun olmadığını bildirdi (550/551/553). Gerçek bir kampanya gönderimi yapılmadı.'],
  smtp_verify_unreachable_mx: ['cleanup', 'system', 'Sistem eledi', 'MX sunucusuna ulaşılamadı', 'Gönderim öncesi SMTP kontrolünde alan adının mail sunucusu iki denemede de yanıt vermedi. Bu, alıcının kendi çıkışı veya gerçek bir bounce değildir; geçici DNS, ağ ya da sunucu sorunu olabilir.'],
  ses_email_validation_suppressed: ['cleanup', 'system', 'Sistem eledi', 'SES ön doğrulama engeli', "AWS SES, iletiyi alıcı sunucusuna teslim etmeyi denemeden kendi adres doğrulama kontrolünde engelledi. Bu bir kullanıcı çıkışı veya gerçek alıcı-sunucu bounce'u değildir."],
  ses_bounce: ['delivery', 'system', 'Teslimat sonrası sistem eledi', 'Kalıcı bounce', 'Gerçek bir gönderim alıcı sunucusundan kalıcı teslimat hatası aldı; sonraki gönderimler otomatik engellendi.'],
  ses_complaint: ['delivery', 'recipient', 'Alıcı spam bildirdi', 'Spam şikâyeti', 'Alıcı veya e-posta sağlayıcısı gönderiyi spam olarak bildirdi; adres global olarak engellendi.'],
  suppressed: ['delivery', 'system', 'Sistem engelledi', 'Global Kara Listede', 'Adres daha önceki bir gönderim engeli nedeniyle global Kara Listede tutuluyor.'],
  legacy_suppression: ['delivery', 'system', 'Sistem engelledi', 'Eski gönderim engeli', 'Eski suppression kaydından taşınan global gönderim engeli; ayrıntılı ilk sebep kayıtta bulunmuyor.'],
};

export const reasonMeta = (reason, supplied) => {
  const code = String(reason || supplied?.code || '').trim();
  if (supplied?.label && supplied?.description) {
    return { ...supplied, code: supplied.code || code };
  }
  const fallback = REASON_FALLBACKS[code];
  if (fallback) {
    const [category, source, sourceLabel, label, description] = fallback;
    return {
      code,
      category,
      categoryLabel: categoryMeta(category).label,
      source,
      sourceLabel,
      selfInitiated: category === 'self',
      label,
      description,
    };
  }
  return {
    code,
    category: 'other',
    categoryLabel: categoryMeta('other').label,
    source: 'unknown',
    sourceLabel: 'Kaynak bilinmiyor',
    selfInitiated: false,
    label: code || 'Sebep belirtilmemiş',
    description: code
      ? 'Bu gerekçe kodu için henüz açıklama tanımlanmamış; alıcının kendi çıktığı varsayılmamalıdır.'
      : 'Çıkış veya engel kaydında gerekçe tutulmamış; işlemi kimin başlattığı belirlenemiyor.',
  };
};

/**
 * Backend `categories` objesini ({ self: n, operator: n, ... }) grafik/legend
 * için diziye çevirir; sıfır olanlar elenir, sabit sırada döner.
 */
export const toCategorySegments = (categories = {}) =>
  UNSUB_CATEGORY_ORDER
    .map((key) => ({ key, value: Number(categories[key]) || 0, ...categoryMeta(key) }))
    .filter((s) => s.value > 0);
