'use client';

/**
 * Şablon "demo / test gönder" alıcılarının tarayıcıda saklanması.
 *
 * Kampanya şablonu önizlemesinden kendine test maili atarken adresi her seferinde
 * elle yazmamak için, kullanılan adresler localStorage'da tutulur (en yeni en başta,
 * MAX ile sınırlı). Yalnızca istemci tarafında çalışır; SSR'de sessizce boş döner.
 */
const KEY = 'cms:mail:demo-recipients';
const MAX = 12;

const normalize = (e) => String(e || '').trim().toLowerCase();

/** Saklı demo adreslerini döndürür (en yeni en başta). */
export function getDemoRecipients() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x) : [];
  } catch {
    return [];
  }
}

/** Bir veya birden çok adresi listenin başına ekler (tekrarsız), günceli döndürür. */
export function addDemoRecipients(emails) {
  const incoming = (Array.isArray(emails) ? emails : [emails]).map(normalize).filter(Boolean);
  if (!incoming.length || typeof window === 'undefined') return getDemoRecipients();
  try {
    const seen = new Set();
    const next = [];
    for (const e of [...incoming, ...getDemoRecipients()]) {
      if (seen.has(e)) continue;
      seen.add(e);
      next.push(e);
      if (next.length >= MAX) break;
    }
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return getDemoRecipients();
  }
}

/** Tek bir adresi saklıdan çıkarır, güncel listeyi döndürür. */
export function removeDemoRecipient(email) {
  if (typeof window === 'undefined') return getDemoRecipients();
  try {
    const target = normalize(email);
    const next = getDemoRecipients().filter((e) => e !== target);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return getDemoRecipients();
  }
}
