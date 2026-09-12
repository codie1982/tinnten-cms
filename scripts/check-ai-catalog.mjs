import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';

const contract = JSON.parse(await readFile('contracts/ai-infrastructure.v1.json', 'utf8'));
assert.equal(contract.version, 'ai-infrastructure.v1');
for (const route of contract.routes.filter(route => route.scope === 'platform')) assert.equal(route.permission, 'cms:admin');
const lint = new ESLint({ overrideConfig: [{ files: ['**/*.jsx'], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } }] });
const results = await lint.lintFiles(['app/(protected)/cms/ai-models/page.jsx', 'lib/ai-catalog.js', 'config/cms-nav.js']);
console.log(await (await lint.loadFormatter('stylish')).format(results));
assert.equal(results.reduce((n, result) => n + result.errorCount + result.warningCount, 0), 0);
console.log('CMS AI contract and JSX checks passed (no provider calls).');
