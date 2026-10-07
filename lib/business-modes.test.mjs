import assert from 'node:assert/strict';
import test from 'node:test';

import contract from '../contracts/business-modes.v2.json' with { type: 'json' };
import {
  BUSINESS_MODE_CONTRACT_VERSION,
  CANONICAL_BUSINESS_MODES,
  businessModeMetaForPayload,
  businessModeOptionsForPayload,
  isBusinessModeContractCompatible,
  normalizeBusinessModes,
} from './business-modes.js';

test('CMS business-modes.v2 kopyası kanonik sözleşmeyle hizalıdır', () => {
  assert.equal(BUSINESS_MODE_CONTRACT_VERSION, 'business-modes.v2');
  assert.deepEqual(CANONICAL_BUSINESS_MODES, [
    'ecommerce',
    'direct',
    'quote',
    'reservation',
    'appointment',
    'standard',
  ]);
  assert.deepEqual(contract.modes.map((mode) => mode.id).sort(), [
    ...CANONICAL_BUSINESS_MODES,
  ].sort());
});

test('CMS legacy content ve service değerlerini kanonik modlara çevirir', () => {
  assert.deepEqual(normalizeBusinessModes(['content']), ['standard']);
  assert.deepEqual(normalizeBusinessModes(['service']), [
    'direct',
    'quote',
    'reservation',
    'appointment',
  ]);
});

test('uyumlu backend sözleşmesi CMS etiket ve filtrelerini üretir', () => {
  const payload = {
    contractVersion: contract.version,
    items: contract.canonicalOrder.map((value) => {
      const mode = contract.modes.find((item) => item.id === value);
      return { ...mode, value, label: `${mode.defaultLabel} API` };
    }),
  };
  assert.equal(isBusinessModeContractCompatible(payload), true);
  assert.equal(businessModeMetaForPayload(payload).standard.label, 'Standart API');
  assert.equal(
    businessModeOptionsForPayload(payload).find((item) => item.value === 'quote').label,
    'Teklif API',
  );
});

test('sürüm veya anahtar uyuşmazlığında checked-in sözleşmeye güvenli düşer', () => {
  const incompatible = { contractVersion: 'business-modes.v1', items: [] };
  assert.equal(isBusinessModeContractCompatible(incompatible), false);
  assert.equal(businessModeMetaForPayload(incompatible).standard.label, 'Standart');
});

test('planned onboarding kartları resolver olmadan etkinleştirilemez', () => {
  const planned = contract.onboarding.goals.filter(
    (goal) => goal.availability === 'planned',
  );
  assert.ok(planned.length > 0);
  assert.ok(planned.every((goal) => goal.strategy === 'planned'));
  assert.ok(planned.every((goal) => !Object.hasOwn(goal, 'businessModes')));
});
