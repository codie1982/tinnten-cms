import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMetricPatch, canEditUsage, getLimitEditor, getMetricChanges,
  metricErrorMessage, seedMetricDraft, usagePercentage,
} from './account-panel-data.mjs';

const metric = (key, limit, used = 0) => ({ key, label: key, limit, used, unlimited: limit == null });
const packages = [{
  id: 'free', isActive: true, packageName: 'company-free',
  limits: { assistant: { published: 1 }, llm: { credit: 1000 }, product: { amount: 0 } },
}, {
  id: 'paid', isActive: true,
  limits: { assistant: { published: 2 }, llm: { credit: 5000 } },
}];

test('editing published assistants sends only that package override and preserves unlimited fields', () => {
  const editor = getLimitEditor([
    metric('assistant.published', 3, 3), metric('llm.credit', 6000, 77),
    metric('product.amount', 0), metric('spaces.count', null, 3), metric('spaces.storage', null, 4501889),
  ], packages);
  const draft = seedMetricDraft(editor.metrics, 'limit');
  assert.equal(draft['assistant.published'], 1);
  assert.equal(editor.metrics[0].accountLimit, 3);
  draft['assistant.published'] = '5';
  assert.deepEqual(buildMetricPatch(editor.metrics, draft, 'limit'), { assistant: { published: 5 } });
  assert.equal(packages[0].limits.assistant.published, 1);
});

test('refetched aggregate values are not written back into a single package', () => {
  const metrics = [metric('assistant.published', 3), metric('llm.credit', 6000)];
  const editor = getLimitEditor(metrics, packages);
  assert.deepEqual(buildMetricPatch(editor.metrics, seedMetricDraft(editor.metrics, 'limit'), 'limit'), {});
  const updatedPackages = [{ ...packages[0], limits: { ...packages[0].limits, assistant: { published: 5 } } }, packages[1]];
  const updated = getLimitEditor([metric('assistant.published', 7), metric('llm.credit', 6000)], updatedPackages);
  assert.equal(updated.metrics[0].limit, 5);
  assert.deepEqual(buildMetricPatch(updated.metrics, seedMetricDraft(updated.metrics, 'limit'), 'limit'), {});
});

test('zero quota and unlimited remain distinct in dirty state and JSON payloads', () => {
  const unlimited = [metric('assistant.published', null)];
  assert.equal(getMetricChanges(unlimited, { 'assistant.published': '' }, 'limit').length, 0);
  assert.deepEqual(buildMetricPatch(unlimited, { 'assistant.published': '0' }, 'limit'), { assistant: { published: 0 } });
  const blocked = [metric('assistant.published', 0)];
  const patch = buildMetricPatch(blocked, { 'assistant.published': '' }, 'limit');
  assert.equal(JSON.stringify(patch), '{"assistant":{"published":null}}');
});

test('sibling changes share a nested PATCH without resending other limits', () => {
  const metrics = [metric('workflow.count', 5), metric('workflow.totalRun', 100), metric('llm.credit', 1000)];
  assert.deepEqual(buildMetricPatch(metrics, {
    'workflow.count': '10', 'workflow.totalRun': '200', 'llm.credit': '1000',
  }, 'limit'), { workflow: { count: 10, totalRun: 200 } });
});

test('Space storage edits use package GB/MB values instead of effective bytes', () => {
  for (const [unit, factor] of [['gb', 1024 ** 3], ['mb', 1024 ** 2]]) {
    const editor = getLimitEditor([metric('spaces.storage', 3 * factor, 100)], [{
      isActive: true, limits: { spaces: { storage: 3, unit } },
    }]);
    assert.equal(editor.metrics[0].limit, 3);
    assert.equal(editor.metrics[0].accountLimit, 3);
    assert.ok(editor.metrics[0].label.endsWith(`(${unit.toUpperCase()})`));
    assert.deepEqual(buildMetricPatch(editor.metrics, { 'spaces.storage': '0.5' }, 'limit'), { spaces: { storage: 0.5 } });
  }
});

test('package fallback and expired target match the CMS PATCH contract', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  const editor = getLimitEditor([metric('assistant.published', 3)], [{
    _id: 'expired', isActive: true, expiredAt: '2025-01-01',
    packageid: { title: 'old', limit: { assistant: { published: 1 } } },
  }, packages[1]], now);
  assert.equal(editor.packageId, 'expired');
  assert.equal(editor.metrics[0].limit, 1);
  assert.equal(editor.editable, false);
  assert.equal(getLimitEditor([], []).editable, false);
  assert.equal(getLimitEditor([], [{ isActive: false }]).editable, false);
  assert.equal(getLimitEditor([], [packages[0]], now).editable, true);
});

test('usage PATCH excludes calculated credits and live resource counts', () => {
  const metrics = [
    metric('assistant.published', 5, 3), metric('spaces.count', null, 3),
    metric('spaces.storage', null, 4501889), metric('company.count', 3, 2),
    metric('llm.credit', 1000, 77), metric('workflow.count', 5, 1), metric('services.amount', 10, 2),
  ];
  const draft = Object.fromEntries(metrics.map((m) => [m.key, '0']));
  assert.deepEqual(buildMetricPatch(metrics, draft, 'used'), { workflow: { count: 0 }, services: { amount: 0 } });
  for (const m of metrics.slice(0, 5)) assert.equal(canEditUsage(m.key), false);
});

test('changing one usage counter does not overwrite other counters', () => {
  const metrics = [metric('services.amount', 10, 2), metric('workflow.totalRun', 100, 40)];
  assert.deepEqual(buildMetricPatch(metrics, { 'services.amount': '3', 'workflow.totalRun': '40' }, 'used'), { services: { amount: 3 } });
});

test('blank usage and invalid numbers fail instead of silently becoming zero or being skipped', () => {
  for (const invalid of ['', '-1', 'NaN', 'Infinity', '1.5', String(Number.MAX_SAFE_INTEGER + 1)]) {
    assert.throws(() => buildMetricPatch([metric('workflow.count', 5, 1)], { 'workflow.count': invalid }, 'used'));
  }
  for (const invalid of ['-1', 'NaN', 'Infinity', '1.5']) {
    assert.throws(() => buildMetricPatch([metric('assistant.published', 3)], { 'assistant.published': invalid }, 'limit'));
  }
});

test('untouched fields do not require seeded draft state', () => {
  assert.deepEqual(buildMetricPatch([metric('spaces.count', null), metric('assistant.published', 3)], {}, 'limit'), {});
});

test('zero quota percentage stays finite and never displays unlimited', () => {
  assert.equal(usagePercentage(metric('product.amount', 0, 0)), 0);
  assert.equal(usagePercentage(metric('product.amount', 0, 3)), 100);
  assert.equal(usagePercentage(metric('product.amount', null, 3)), 0);
  assert.equal(usagePercentage(metric('product.amount', 10, 4)), 40);
});

test('API error details are preserved for failed writes', () => {
  assert.equal(metricErrorMessage({ normalizedMessage: 'İzin yok' }, 'fallback'), 'İzin yok');
  assert.equal(metricErrorMessage({ data: { status: { description: 'Geçersiz limit' } } }, 'fallback'), 'Geçersiz limit');
  assert.equal(metricErrorMessage(new Error('Invalid count'), 'fallback'), 'Invalid count');
});
