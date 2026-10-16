const INTEGER_KEYS = new Set([
  'product.amount', 'services.amount', 'offer.max', 'llm.credit',
  'workflow.count', 'workflow.totalRun', 'assistant.published',
  'spaces.count', 'company.count',
]);

// These displayed metrics are accepted by the CMS usage PATCH endpoints.
// Credit usage is calculated from costs; assistant/space/company counts are live.
const EDITABLE_USAGE_KEYS = new Set([
  'product.amount', 'services.amount', 'offer.max',
  'workflow.count', 'workflow.totalRun',
  'file.maxfileupload', 'image.maxfileupload', 'video.maxfileupload',
]);

const getNested = (object, key) => key.split('.').reduce((value, part) => value?.[part], object);

export function getLimitEditor(metrics, packages = [], now = Date.now()) {
  // Match the package selected by both CMS limit PATCH endpoints.
  const pkg = packages.find((item) => item.isActive) ?? packages.at(-1);
  const limits = pkg?.limits ?? pkg?.packageid?.limit ?? {};
  const storageUnit = limits.spaces?.unit === 'mb' ? 'MB' : 'GB';
  const storageFactor = storageUnit === 'MB' ? 1024 ** 2 : 1024 ** 3;
  const editable = Boolean(pkg?.isActive && (!pkg.expiredAt || new Date(pkg.expiredAt).getTime() >= now));

  return {
    packageId: String(pkg?._id ?? pkg?.id ?? ''),
    packageName: pkg?.packageName ?? pkg?.name ?? pkg?.packageid?.title,
    editable,
    metrics: metrics.map((metric) => {
      const limit = getNested(limits, metric.key) ?? null;
      const isStorage = metric.key === 'spaces.storage';
      return {
        ...metric,
        label: isStorage ? `${metric.label} (${storageUnit})` : metric.label,
        used: isStorage ? `${metric.used} B` : metric.used,
        limit,
        unlimited: limit === null,
        accountLimit: isStorage && metric.limit != null ? metric.limit / storageFactor : metric.limit,
        step: INTEGER_KEYS.has(metric.key) ? 1 : 'any',
      };
    }),
  };
}

export function canEditUsage(key) {
  return EDITABLE_USAGE_KEYS.has(key);
}

export function seedMetricDraft(metrics, field) {
  return Object.fromEntries(metrics.map((metric) => [metric.key, metric[field] ?? '']));
}

export function parseMetricValue(value, key, field) {
  if (value == null || String(value).trim() === '') {
    return field === 'limit' ? null : NaN;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) return NaN;
  if (INTEGER_KEYS.has(key) && !Number.isSafeInteger(number)) return NaN;
  return number;
}

export function getMetricChanges(metrics, draft, field) {
  return metrics.filter((metric) => {
    const value = Object.hasOwn(draft, metric.key) ? draft[metric.key] : metric[field];
    return !Object.is(parseMetricValue(value, metric.key, field), parseMetricValue(metric[field], metric.key, field));
  });
}

export function buildMetricPatch(metrics, draft, field) {
  const patch = {};
  for (const metric of getMetricChanges(metrics, draft, field)) {
    if (field === 'used' && !canEditUsage(metric.key)) continue;
    const value = parseMetricValue(draft[metric.key], metric.key, field);
    if (Number.isNaN(value)) throw new Error(`${metric.label}: geçerli, negatif olmayan bir ${INTEGER_KEYS.has(metric.key) ? 'tam sayı' : 'sayı'} girin.`);
    const parts = metric.key.split('.');
    if (parts.some((part) => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) {
      throw new Error('Geçersiz metrik.');
    }
    let target = patch;
    for (const part of parts.slice(0, -1)) target = target[part] ??= {};
    target[parts.at(-1)] = value;
  }
  return patch;
}

export function metricErrorMessage(error, fallback) {
  return error?.normalizedMessage || error?.data?.message || error?.data?.status?.description || error?.message || fallback;
}

export function usagePercentage(metric) {
  if (metric.unlimited) return 0;
  if (!metric.limit) return metric.used > 0 ? 100 : 0;
  return Math.min(Math.round((metric.used / metric.limit) * 100), 100);
}
