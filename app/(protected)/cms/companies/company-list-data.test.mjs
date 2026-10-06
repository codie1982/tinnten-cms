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

test('eski kayıtlarda tekil çalışma moduna geri düşer', () => {
  assert.deepEqual(resolveCompanyBusinessModes({ businessMode: 'content' }), [
    'content',
  ]);
  assert.deepEqual(resolveCompanyBusinessModes({}), []);
});
