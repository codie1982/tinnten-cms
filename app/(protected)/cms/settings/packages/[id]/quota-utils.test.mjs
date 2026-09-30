import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocatedStorageUsd,
  buildPricingAnalysisPhases,
  buildLimitBody,
  BYTES_PER_GIB,
  BYTES_PER_MIB,
  createDefaultStorageCostRates,
  decimalUnitToBytes,
  DEFAULT_STORAGE_USD_PER_BYTE_MONTH,
  DEFAULT_STORAGE_USD_PER_GIB_MONTH,
  mergeLimits,
  PAYMENT_PLAN_TYPES,
  periodMonths,
  resolvePaymentPlanType,
  usdPerByteMonthToUsdPerGiBMonth,
  usdPerGiBMonthToUsdPerByteMonth,
} from './quota-utils.mjs';

test('GB display values become deterministic integer bytes', () => {
  assert.equal(decimalUnitToBytes('1'), BYTES_PER_GIB);
  assert.equal(decimalUnitToBytes('0.5'), BYTES_PER_GIB / 2);
  assert.equal(decimalUnitToBytes('0'), 0);
  assert.equal(decimalUnitToBytes(''), null);
});

test('GB-month tariff round-trips through the exact per-byte decimal string', () => {
  const perByte = usdPerGiBMonthToUsdPerByteMonth('0.001');
  assert.equal(perByte, '0.000000000000931322574615478515625');
  assert.equal(usdPerByteMonthToUsdPerGiBMonth(perByte), '0.001');
});

test('AWS Frankfurt storage baseline is exact and uses binary GB', () => {
  assert.equal(DEFAULT_STORAGE_USD_PER_GIB_MONTH, '0.0245');
  assert.equal(
    usdPerGiBMonthToUsdPerByteMonth(DEFAULT_STORAGE_USD_PER_GIB_MONTH),
    DEFAULT_STORAGE_USD_PER_BYTE_MONTH,
  );
  assert.deepEqual(createDefaultStorageCostRates(), {
    storage: { usdPerByteMonth: DEFAULT_STORAGE_USD_PER_BYTE_MONTH },
  });
});

test('payment plan type remains compatible with legacy renewal and intro fields', () => {
  assert.equal(
    resolvePaymentPlanType({ interval: 'month', isRenewable: false }),
    PAYMENT_PLAN_TYPES.FIXED_TERM,
  );
  assert.equal(
    resolvePaymentPlanType({ interval: 'month', isRenewable: true }),
    PAYMENT_PLAN_TYPES.RECURRING,
  );
  assert.equal(
    resolvePaymentPlanType({ interval: 'month', introductoryPrice: { amount: 1 } }),
    PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING,
  );
});

test('profit phases price the introductory cycles separately from discounted regular cycles', () => {
  const phases = buildPricingAnalysisPhases({
    interval: 'month',
    durationTime: 1,
    currency: 'USD',
    amount: 69,
    discount: 90,
    paymentPlanType: PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING,
    introductoryAmount: 0.01,
    introductoryBillingCycles: 2,
  });

  assert.deepEqual(phases, [
    {
      type: 'introductory',
      label: 'Başlangıç · ilk 2 ay toplam',
      cycleCount: 2,
      months: 2,
      revenueUsd: 0.02,
      discount: 0,
    },
    {
      type: 'standard',
      label: 'Standart · sonraki her ay',
      cycleCount: 1,
      months: 1,
      revenueUsd: 6.9,
      discount: 90,
    },
  ]);
});

test('legacy media buckets are merged into one storage stock and upload caps', () => {
  const merged = mergeLimits({
    file: { upload: 512, maxfileupload: 20, unit: 'mb', stream: 99 },
    image: { upload: 256, maxfileupload: 10, unit: 'mb' },
    video: { upload: 1, maxfileupload: 0.25, unit: 'gb' },
    team: { member: 7 },
  });

  assert.equal(merged.storage.maxBytes, (512 + 256) * BYTES_PER_MIB + BYTES_PER_GIB);
  assert.equal(merged.uploads.fileMaxBytes, 20 * BYTES_PER_MIB);
  assert.equal(merged.uploads.imageMaxBytes, 10 * BYTES_PER_MIB);
  assert.equal(merged.uploads.videoMaxBytes, BYTES_PER_GIB / 4);
  assert.equal(merged.team.seats, 7);
});

test('package serializer keeps byte quotas and removes stream/download buckets', () => {
  const payload = buildLimitBody({
    storage: { maxBytes: BYTES_PER_GIB },
    uploads: { fileMaxBytes: 0, imageMaxBytes: null, videoMaxBytes: 2 * BYTES_PER_GIB },
    file: { download: 5, stream: 10 },
    team: { seats: 4 },
    website: { count: 2 },
    crawl: { pages: 1000 },
    index: { documents: 500, vectorBytes: 123456 },
  });

  assert.deepEqual(payload.storage, { maxBytes: BYTES_PER_GIB });
  assert.deepEqual(payload.uploads, {
    fileMaxBytes: 0,
    imageMaxBytes: null,
    videoMaxBytes: 2 * BYTES_PER_GIB,
  });
  assert.deepEqual(payload.team, { seats: 4 });
  assert.deepEqual(payload.index, { documents: 500, vectorBytes: 123456 });
  assert.equal('file' in payload, false);
  assert.equal(JSON.stringify(payload).includes('stream'), false);
});

test('allocated storage cost uses byte rate and full period months', () => {
  const perByte = usdPerGiBMonthToUsdPerByteMonth('0.001');
  assert.equal(periodMonths('month', 2), 2);
  assert.equal(periodMonths('year', 1), 12);
  assert.equal(periodMonths('lifetime', 1), null);
  assert.equal(
    allocatedStorageUsd({ maxBytes: BYTES_PER_GIB, usdPerByteMonth: perByte, months: 12 }),
    0.012,
  );
  assert.equal(
    allocatedStorageUsd({ maxBytes: null, usdPerByteMonth: perByte, months: 12 }),
    null,
  );
});
