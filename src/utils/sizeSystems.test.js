import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSizeSystemCode,
  formatSizeSelectionLabel,
  normalizeSizeSystems,
  parseSizeSelection,
  validateSizeSystemSpecs,
} from './sizeSystems.js';

const systems = normalizeSizeSystems([
  { code: 'US', label: 'US', sizes: [{ label: '7 1/2', mm: 55.7 }, { label: '7', mm: 54.4 }] },
  { code: 'UK', label: 'UK', sizes: [{ label: 'N', mm: 54.4 }, { label: 'O', mm: 55.7 }] },
  { code: 'IN', label: 'India', sizes: [{ label: '14', mm: 54.4 }, { label: '15', mm: 55.1 }, { label: '16', mm: 56.3 }] },
]);

test('round-trips the saved label', () => {
  const label = formatSizeSelectionLabel(systems, 'US', '7 1/2');
  assert.equal(label, 'US 7 1/2 · 55.7 mm (≈ UK O · India 16)');
  assert.deepEqual(parseSizeSelection(systems, label), { code: 'US', label: '7 1/2' });
  assert.deepEqual(parseSizeSelection(systems, formatSizeSelectionLabel(systems, 'IN', '14')), { code: 'IN', label: '14' });
});

test('reads older single-list labels', () => {
  assert.deepEqual(parseSizeSelection(systems, 'N (54.4 mm)'), { code: 'UK', label: 'N' });
  assert.deepEqual(parseSizeSelection(systems, '7'), { code: 'US', label: '7' });
  assert.equal(parseSizeSelection(systems, 'Large'), null);
});

test('picks the starting toggle from the region', () => {
  assert.equal(defaultSizeSystemCode(systems, 'IN'), 'IN');
  assert.equal(defaultSizeSystemCode(systems, 'GB'), 'UK');
  assert.equal(defaultSizeSystemCode(systems, 'DE'), 'US');
  assert.equal(defaultSizeSystemCode([], 'IN'), '');
});

test('validates standard and custom ring sizes', () => {
  assert.equal(validateSizeSystemSpecs(systems, { sizeMode: 'standard', sizeStandard: '' }), 'Size is required');
  assert.equal(validateSizeSystemSpecs(systems, { sizeMode: 'standard', sizeStandard: 'UK N · 54.4 mm' }), null);
  assert.equal(validateSizeSystemSpecs(systems, { sizeMode: 'custom', sizeCustomValue: '54.4' }), null);
  assert.match(validateSizeSystemSpecs(systems, { sizeMode: 'custom', sizeCustomValue: '17' }), /between 35 and 80/);
});
