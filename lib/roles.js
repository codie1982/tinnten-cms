// CMS rolleri — düz (flat) ve additive. Bir kullanıcı aynı anda birden çok
// rol taşıyabilir. Diğer roller arasında hiyerarşi YOK (any-of eşleşme).
// İSTİSNA: cms:admin bir SÜPER roldür — tüm sayfalara erişir (en üst rol).
// Böylece callcenter/support gibi roller bağımsız kalırken admin her şeyi görür.
// Yeni rol eklemek için buraya ekle, sayfanın roles dizisine yaz.
export const CMS_ROLES = {
  ACCESS: 'cms:access', // CMS'e giriş — login'de zorunlu, tüm CMS kullanıcılarında var
  EDITOR: 'cms:editor', // içerik oluşturma / düzenleme
  ADMIN: 'cms:admin', // SÜPER ROL — kullanıcı/hesap/sistem yönetimi + tüm sayfalar
  // CALLCENTER: 'cms:callcenter',
  // SUPPORT: 'cms:support',
};

// En üst (süper) rol. Bu role sahip kullanıcı tüm rol kontrollerini geçer.
export const SUPER_ROLE = CMS_ROLES.ADMIN;

// any-of: kullanıcının rolleri, sayfanın izin verdiği rollerden en az biriyle eşleşiyor mu?
// allowedRoles boş/undefined ise sayfa tüm CMS kullanıcılarına açıktır.
// cms:admin taşıyan kullanıcı her zaman erişir.
export function canAccess(userRoles = [], allowedRoles) {
  const set = new Set(userRoles || []);
  if (set.has(SUPER_ROLE)) return true; // süper rol her şeyi görür
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.some((role) => set.has(role));
}

// Tek rol kontrolü.
export function hasRole(userRoles = [], role) {
  return (userRoles || []).includes(role);
}

// Çoklu rol kontrolü (any-of).
export function hasAnyRole(userRoles = [], roles = []) {
  const set = new Set(userRoles || []);
  return roles.some((role) => set.has(role));
}
