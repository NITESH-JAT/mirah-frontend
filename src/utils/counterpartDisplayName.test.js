import test from 'node:test';
import assert from 'node:assert/strict';
import {
  counterpartDisplayName,
  counterpartFirstName,
  joinCounterpartName,
} from './counterpartDisplayName.js';
import { getVendorDisplayName } from './productSource.js';

test('frontend counterpart helpers keep first name only', () => {
  assert.equal(counterpartFirstName({ firstName: 'Amaresh', lastName: 'Parida' }), 'Amaresh');
  assert.equal(counterpartDisplayName({ firstName: 'Amaresh', lastName: 'Parida' }), 'Amaresh');
  assert.equal(counterpartDisplayName({ name: 'Amaresh Parida' }), 'Amaresh');
  assert.equal(joinCounterpartName('Amaresh', 'Parida'), 'Amaresh');
  assert.equal(joinCounterpartName('', 'Parida', 'Jeweller'), 'Jeweller');
});

test('getVendorDisplayName strips last names from parts and multi-word strings', () => {
  assert.equal(
    getVendorDisplayName({
      vendor: { firstName: 'Ravi', lastName: 'Kumar' },
    }),
    'Ravi',
  );
  assert.equal(
    getVendorDisplayName({
      vendorName: 'Ravi Kumar',
    }),
    'Ravi',
  );
  assert.equal(getVendorDisplayName({ vendor: {} }), null);
});
