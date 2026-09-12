import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';
import { isCreditRate } from '../lib/ai-credit-pricing.mjs';
for (const value of ['0', '15', '60', '0.000001', '25.2']) assert.equal(isCreditRate(value), true);
for (const value of [15, '-1', '1e3', '0.0000001', 'NaN', '']) assert.equal(isCreditRate(value), false);

const contract = JSON.parse(await readFile('contracts/ai-infrastructure.v1.json', 'utf8'));
assert.equal(contract.version, 'ai-infrastructure.v1');
for (const route of contract.routes.filter(route => route.scope === 'platform')) assert.equal(route.permission, 'cms:admin');
const lint = new ESLint({ overrideConfig: [{ files: ['**/*.jsx'], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } }] });
const results = await lint.lintFiles(['app/(protected)/cms/ai-models/page.jsx', 'lib/ai-catalog.js', 'config/cms-nav.js']);
console.log(await (await lint.loadFormatter('stylish')).format(results));
assert.equal(results.reduce((n, result) => n + result.errorCount + result.warningCount, 0), 0);
console.log('CMS AI contract and JSX checks passed (no provider calls).');
