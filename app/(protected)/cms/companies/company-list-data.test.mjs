import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveCompanyBusinessModes,
  resolveCompanyTypeGroup,
} from './_data.js';

test('firma tiplerini Bireysel ve Ticari gruplarına indirger', () => {
  assert.equal(resolveCompanyTypeGroup('individual'), 'individual');
  assert.equal(resolveCompanyTypeGroup('corporate'), 'commercial');
  assert.equal(resolveCompanyTypeGroup('limited'), 'commercial');
  assert.equal(resolveCompanyTypeGroup('unknown'), null);
});

test('çoklu çalışma modlarını tekilleştirir', () => {
  assert.deepEqual(
    resolveCompanyBusinessModes({
      businessMode: 'direct',
      businessModes: ['quote', 'appointment', 'quote'],
    }),
    ['quote', 'appointment'],
  );
});

test('eski content kaydını standard olarak okur', () => {
  assert.deepEqual(resolveCompanyBusinessModes({ businessMode: 'content' }), [
    'standard',
  ]);
  assert.deepEqual(resolveCompanyBusinessModes({}), []);
});

test('legacy service hizmet ailesine genişler', () => {
  assert.deepEqual(resolveCompanyBusinessModes({ businessMode: 'service' }), [
    'direct',
    'quote',
    'reservation',
    'appointment',
  ]);
});
