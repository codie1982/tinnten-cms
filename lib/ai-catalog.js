import http from '@/lib/http';
import contract from '@/contracts/ai-infrastructure.v1.json';

export const AI_ROLES = contract.roles;
export const AI_PROVIDERS = contract.providers.filter(item => item !== 'tinnten');
export const AI_CONNECTION_TYPES = contract.providers.filter(item => item !== 'digitalocean');
export const isDecimal = value => typeof value === 'string' && /^(0|[1-9]\d{0,12})(\.\d{1,12})?$/.test(value);
export const canWriteCatalog = context => context?.contractVersion === contract.version && context.availability?.catalog === true;
export const catalogError = error => {
  if ([404, 501].includes(error?.status) || [404, 501].includes(error?.response?.status)) return 'Backend katalog servisi henüz etkin değil. Kayıt ve yayın işlemleri kapalıdır.';
  if ([401, 403].includes(error?.status) || [401, 403].includes(error?.response?.status)) return 'CMS yönetici yetkisi gereklidir.';
  if (error?.status === 409 || error?.response?.status === 409) return 'Model sürümü değişti. Güncel kaydı yeniden yükleyin.';
  return 'İşlem tamamlanamadı. Yeniden deneyin.';
};
async function write(context, path, body, method = 'post') {
  if (!canWriteCatalog(context)) throw new Error('AI_WRITE_DISABLED');
  const response = await http.request({ method, url: path, data: body, headers: { 'Idempotency-Key': crypto.randomUUID() } });
  if (!response.data?.success) throw new Error('AI_REQUEST_FAILED');
  return response.data.data;
}
export const aiCatalogApi = {
  async context(signal) {
    const response = await http.get('/cms/ai/context', { signal });
    if (!response.data?.success || response.data.data?.contractVersion !== contract.version) throw new Error('AI_CONTRACT_MISMATCH');
    return response.data.data;
  },
  async models(signal, cursor) { const response = await http.get('/cms/ai/models', { signal, params: { cursor, limit: 25 } }); if (!response.data?.success) throw new Error('AI_REQUEST_FAILED'); return response.data.data; },
  create: (context, body) => write(context, '/cms/ai/models', body),
  price: (context, id, body) => write(context, `/cms/ai/models/${encodeURIComponent(id)}/prices`, body),
  publish: (context, model) => write(context, `/cms/ai/models/${encodeURIComponent(model.id)}/publish`, { expectedVersion: model.version }),
  disable: (context, model) => write(context, `/cms/ai/models/${encodeURIComponent(model.id)}`, { enabled: false, expectedVersion: model.version }, 'patch'),
};
