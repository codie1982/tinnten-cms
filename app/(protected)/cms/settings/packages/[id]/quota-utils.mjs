const POW10 = (places) => 10n ** BigInt(places);

export const BYTES_PER_KIB = 1024;
export const BYTES_PER_MIB = 1024 ** 2;
export const BYTES_PER_GIB = 1024 ** 3;
export const BYTES_PER_TIB = 1024 ** 4;

// AWS S3 Standard, Europe (Frankfurt / eu-central-1), first 50 TB tier.
// AWS defines its storage GB as 2^30 bytes, matching this editor's GiB unit.
// Request, retrieval and internet egress costs remain separate.
export const DEFAULT_STORAGE_USD_PER_GIB_MONTH = '0.0245';
export const DEFAULT_STORAGE_USD_PER_BYTE_MONTH =
  '0.0000000000228174030780792236328125';

export function createDefaultStorageCostRates() {
  return {
    storage: { usdPerByteMonth: DEFAULT_STORAGE_USD_PER_BYTE_MONTH },
  };
}

export const PAYMENT_PLAN_TYPES = Object.freeze({
  FIXED_TERM: 'fixed_term',
  RECURRING: 'recurring',
  INTRODUCTORY_RECURRING: 'introductory_recurring',
  NO_PAYMENT: 'no_payment',
});

const BINARY_UNIT_BYTES = {
  b: 1,
  kb: BYTES_PER_KIB,
  mb: BYTES_PER_MIB,
  gb: BYTES_PER_GIB,
  tb: BYTES_PER_TIB,
};

export const DEFAULT_LIMITS = {
  product: { amount: 10 },
  services: { amount: 10 },
  storage: { maxBytes: null },
  uploads: {
    fileMaxBytes: null,
    imageMaxBytes: null,
    videoMaxBytes: null,
  },
  offer: { max: 10 },
  llm: { token: 1024, credit: 1000 },
  workflow: { count: 5, totalRun: 100 },
  assistant: { published: 1, tools: 5, libraryFiles: 10, previewViewsPerMonth: 100 },
  company: { count: 1 },
  team: { seats: null },
  website: { count: null },
  crawl: { pages: null },
  index: { documents: null, vectorBytes: null },
  mcp: { server: 1, requestsPerMinute: null, maxConcurrent: null },
  maxDevices: null,
};

export function cloneDefaultLimits() {
  return JSON.parse(JSON.stringify(DEFAULT_LIMITS));
}

function parseUnsignedDecimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  const match = /^(\d+)(?:\.(\d*))?$/.exec(raw);
  if (!match) return null;
  const fraction = match[2] || '';
  return {
    coefficient: BigInt(`${match[1]}${fraction}`),
    scale: fraction.length,
  };
}

function decimalPartsToString(coefficient, scale) {
  if (coefficient === 0n) return '0';
  let digits = coefficient.toString();
  if (scale === 0) return digits;
  if (digits.length <= scale) digits = `${'0'.repeat(scale - digits.length + 1)}${digits}`;
  const splitAt = digits.length - scale;
  const integer = digits.slice(0, splitAt);
  const fraction = digits.slice(splitAt).replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}

/**
 * Converts a human decimal unit to an integer byte count without IEEE-754 drift.
 * Fractions smaller than one byte are rounded to the nearest byte (half-up).
 */
export function decimalUnitToBytes(value, unitBytes = BYTES_PER_GIB) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseUnsignedDecimal(value);
  if (!parsed) return null;
  const denominator = POW10(parsed.scale);
  const numerator = parsed.coefficient * BigInt(unitBytes);
  const rounded = (numerator + denominator / 2n) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(rounded);
}

export function bytesToGiBDisplay(value, maximumFractionDigits = 6) {
  if (value === null || value === undefined || value === '') return '';
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes < 0) return '';
  const raw = bytes / BYTES_PER_GIB;
  return raw.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits,
  });
}

/** Exact conversion because GiB (2^30 bytes) has a finite decimal reciprocal. */
export function usdPerGiBMonthToUsdPerByteMonth(value) {
  if (value === null || value === undefined || value === '') return '0';
  const parsed = parseUnsignedDecimal(value);
  if (!parsed) return null;
  // c / (10^scale * 2^30) = c * 5^30 / 10^(scale + 30)
  return decimalPartsToString(parsed.coefficient * (5n ** 30n), parsed.scale + 30);
}

export function usdPerByteMonthToUsdPerGiBMonth(value) {
  const parsed = parseUnsignedDecimal(value);
  if (!parsed) return '0';
  return decimalPartsToString(parsed.coefficient * BigInt(BYTES_PER_GIB), parsed.scale);
}

export function normalizeNonNegativeDecimal(value, fallback = '0') {
  const parsed = parseUnsignedDecimal(value);
  return parsed ? decimalPartsToString(parsed.coefficient, parsed.scale) : fallback;
}

export function multiplyDecimalByIntegers(value, ...factors) {
  const parsed = parseUnsignedDecimal(value);
  if (!parsed) return null;
  let coefficient = parsed.coefficient;
  for (const factor of factors) {
    const integer = Number(factor);
    if (!Number.isSafeInteger(integer) || integer < 0) return null;
    coefficient *= BigInt(integer);
  }
  return decimalPartsToString(coefficient, parsed.scale);
}

export function periodMonths(interval, durationTime = 1) {
  const duration = Math.max(1, Math.trunc(Number(durationTime) || 1));
  if (interval === 'month') return duration;
  if (interval === 'year') return duration * 12;
  return null;
}

const optionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const money = (value) => Number(Number(value || 0).toFixed(2));

/**
 * CMS state keeps a UI-only paymentPlanType. Persistence remains compatible
 * with the server contract: isRenewable + optional introductoryPrice. Public
 * package responses may already contain the server-resolved paymentPlan.type,
 * so that is accepted as another source when loading existing records.
 */
export function resolvePaymentPlanType(pricing = {}) {
  const explicit = pricing.paymentPlanType || pricing.paymentPlan?.type;
  if (Object.values(PAYMENT_PLAN_TYPES).includes(explicit)) return explicit;

  const hasIntro =
    pricing.introductoryAmount !== '' &&
    pricing.introductoryAmount !== null &&
    pricing.introductoryAmount !== undefined
      ? true
      : pricing.introductoryPrice?.amount !== '' &&
        pricing.introductoryPrice?.amount !== null &&
        pricing.introductoryPrice?.amount !== undefined;
  if (hasIntro) return PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING;
  if (pricing.interval === 'lifetime' || pricing.unlimited === true) {
    return PAYMENT_PLAN_TYPES.NO_PAYMENT;
  }
  return pricing.isRenewable === true
    ? PAYMENT_PLAN_TYPES.RECURRING
    : PAYMENT_PLAN_TYPES.FIXED_TERM;
}

/**
 * Profit rows follow charge phases, not merely the package price row. This is
 * what keeps an introductory first N cycles distinct from the standard cycle.
 */
export function buildPricingAnalysisPhases(pricing = {}) {
  const planType = resolvePaymentPlanType(pricing);
  const interval = pricing.interval || 'month';
  const baseMonths = periodMonths(interval, pricing.durationTime) ?? 1;
  const baseUsd = pricing.currency === 'USD'
    ? optionalNumber(pricing.amount)
    : optionalNumber(pricing.localPrices?.USD);
  const discount = Math.min(100, Math.max(0, optionalNumber(pricing.discount) || 0));
  const regularUsd = baseUsd === null ? null : money(baseUsd * (1 - discount / 100));

  if (planType !== PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING) {
    const labels = {
      [PAYMENT_PLAN_TYPES.FIXED_TERM]: 'Tek dönem',
      [PAYMENT_PLAN_TYPES.RECURRING]: interval === 'year' ? 'Standart · her yıl' : 'Standart · her ay',
      [PAYMENT_PLAN_TYPES.NO_PAYMENT]: 'Ücretsiz',
    };
    return [{
      type: planType,
      label: labels[planType] || 'Standart',
      cycleCount: 1,
      months: baseMonths,
      revenueUsd: planType === PAYMENT_PLAN_TYPES.NO_PAYMENT ? 0 : regularUsd,
      discount,
    }];
  }

  const rawCycles = optionalNumber(
    pricing.introductoryBillingCycles ?? pricing.introductoryPrice?.billingCycles,
  );
  const cycles = Number.isInteger(rawCycles) && rawCycles >= 1 ? rawCycles : 1;
  const introUsd = pricing.currency === 'USD'
    ? optionalNumber(pricing.introductoryAmount ?? pricing.introductoryPrice?.amount)
    : optionalNumber(
        pricing.introductoryLocalPrices?.USD ??
        pricing.introductoryPrice?.localPrices?.USD,
      );

  return [
    {
      type: 'introductory',
      label: `Başlangıç · ilk ${cycles} ay toplam`,
      cycleCount: cycles,
      months: baseMonths * cycles,
      revenueUsd: introUsd === null ? null : money(introUsd * cycles),
      discount: 0,
    },
    {
      type: 'standard',
      label: 'Standart · sonraki her ay',
      cycleCount: 1,
      months: baseMonths,
      revenueUsd: regularUsd,
      discount,
    },
  ];
}

export function allocatedStorageUsd({ maxBytes, usdPerByteMonth, months }) {
  if (maxBytes === null || maxBytes === undefined || months === null || months === undefined) return null;
  const bytes = Number(maxBytes);
  if (!Number.isSafeInteger(bytes) || bytes < 0) return null;
  const exact = multiplyDecimalByIntegers(usdPerByteMonth, bytes, months);
  if (exact === null) return null;
  const amount = Number(exact);
  return Number.isFinite(amount) ? amount : null;
}

function nullableInteger(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) return fallback;
  return n;
}

function numberValue(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function legacySizeToBytes(group, key) {
  const raw = group?.[key];
  if (raw === '' || raw === null || raw === undefined) return null;
  const unitBytes = BINARY_UNIT_BYTES[String(group?.unit || 'mb').toLowerCase()] || BYTES_PER_MIB;
  return decimalUnitToBytes(raw, unitBytes);
}

/**
 * Normalizes old file/image/video quotas into the byte-based contract while
 * keeping unrelated inbound fields available in memory during a rolling deploy.
 */
export function mergeLimits(incoming) {
  const out = cloneDefaultLimits();
  if (!incoming || typeof incoming !== 'object') return out;
  for (const [key, value] of Object.entries(incoming)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = { ...(out[key] || {}), ...value };
    } else if (value === null && out[key] && typeof out[key] === 'object') {
      // A null group from an old/partial document must not erase the canonical
      // object that the compatibility conversion below writes into.
      continue;
    } else if (value !== undefined) {
      out[key] = value;
    }
  }

  if (incoming.storage?.maxBytes === undefined) {
    const legacyUploads = ['file', 'image', 'video']
      .map((key) => legacySizeToBytes(incoming[key], 'upload'))
      .filter((value) => value !== null);
    out.storage.maxBytes = legacyUploads.length
      ? legacyUploads.reduce((total, bytes) => total + bytes, 0)
      : null;
  }

  out.uploads = {
    fileMaxBytes:
      incoming.uploads?.fileMaxBytes !== undefined
        ? incoming.uploads.fileMaxBytes
        : legacySizeToBytes(incoming.file, 'maxfileupload'),
    imageMaxBytes:
      incoming.uploads?.imageMaxBytes !== undefined
        ? incoming.uploads.imageMaxBytes
        : legacySizeToBytes(incoming.image, 'maxfileupload'),
    videoMaxBytes:
      incoming.uploads?.videoMaxBytes !== undefined
        ? incoming.uploads.videoMaxBytes
        : legacySizeToBytes(incoming.video, 'maxfileupload'),
  };

  if (incoming.team?.seats === undefined && incoming.team?.member !== undefined) {
    out.team.seats = incoming.team.member;
  }
  return out;
}

/** Whitelist sent to the package API. Legacy stream/download buckets stay out. */
export function buildLimitBody(limits = DEFAULT_LIMITS) {
  return {
    product: { amount: numberValue(limits.product?.amount, 10) },
    services: { amount: numberValue(limits.services?.amount, 10) },
    storage: { maxBytes: nullableInteger(limits.storage?.maxBytes) },
    uploads: {
      fileMaxBytes: nullableInteger(limits.uploads?.fileMaxBytes),
      imageMaxBytes: nullableInteger(limits.uploads?.imageMaxBytes),
      videoMaxBytes: nullableInteger(limits.uploads?.videoMaxBytes),
    },
    offer: { max: numberValue(limits.offer?.max, 10) },
    llm: {
      token: numberValue(limits.llm?.token, 1024),
      credit: nullableInteger(limits.llm?.credit, 1000),
    },
    workflow: {
      count: nullableInteger(limits.workflow?.count),
      totalRun: nullableInteger(limits.workflow?.totalRun),
    },
    assistant: {
      published: nullableInteger(limits.assistant?.published, 1),
      tools: nullableInteger(limits.assistant?.tools, 5),
      libraryFiles: nullableInteger(limits.assistant?.libraryFiles, 10),
      previewViewsPerMonth: nullableInteger(limits.assistant?.previewViewsPerMonth, 100),
    },
    company: { count: nullableInteger(limits.company?.count, 1) },
    team: { seats: nullableInteger(limits.team?.seats) },
    website: { count: nullableInteger(limits.website?.count) },
    crawl: { pages: nullableInteger(limits.crawl?.pages) },
    index: {
      documents: nullableInteger(limits.index?.documents),
      vectorBytes: nullableInteger(limits.index?.vectorBytes),
    },
    mcp: {
      server: nullableInteger(limits.mcp?.server, 1),
      requestsPerMinute: nullableInteger(limits.mcp?.requestsPerMinute),
      maxConcurrent: nullableInteger(limits.mcp?.maxConcurrent),
    },
    maxDevices: nullableInteger(limits.maxDevices),
  };
}
