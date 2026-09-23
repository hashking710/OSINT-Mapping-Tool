import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPinLabelOptions, filterPinsByLabels, linkedIdentifiersFor } from '../src/utils/pinLabels.js';

const identifiers = [
  { id: 'a', tags: ['family'], color: 'blue' },
  { id: 'b', tags: ['Family', 'courier'], color: 'red' },
  { id: 'c', tags: [], color: 'blue' },
];
const pins = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];
const pinLinks = [
  { id: '1', pinId: 'p1', identifierId: 'a' },
  { id: '2', pinId: 'p1', identifierId: 'b' },
  { id: '3', pinId: 'p2', identifierId: 'b' },
  { id: '4', pinId: 'p3', identifierId: 'c' },
];

test('finds the identifiers linked to a pin', () => {
  assert.deepEqual(linkedIdentifiersFor('p1', pinLinks, identifiers).map((i) => i.id), ['a', 'b']);
  assert.deepEqual(linkedIdentifiersFor('p4', pinLinks, identifiers), []);
});

test('counts each tag once per pin and lists colours in palette order', () => {
  const options = collectPinLabelOptions(pins, pinLinks, identifiers);
  assert.deepEqual(options.tags, [
    { tag: 'courier', count: 2 },
    { tag: 'family', count: 2 },
  ]);
  assert.deepEqual(options.colors, ['red', 'blue']);
});

test('filters pins by the labels of their linked identifiers', () => {
  const ids = (filter) => filterPinsByLabels(pins, pinLinks, identifiers, filter).map((p) => p.id);
  assert.deepEqual(ids({ tag: 'FAMILY' }), ['p1', 'p2']);
  assert.deepEqual(ids({ tag: 'courier' }), ['p1', 'p2']);
  assert.deepEqual(ids({ color: 'blue' }), ['p1', 'p3']);
  assert.deepEqual(ids({}), ['p1', 'p2', 'p3', 'p4']);
});

test('tag and colour together must come from the same linked identifier', () => {
  const ids = (filter) => filterPinsByLabels(pins, pinLinks, identifiers, filter).map((p) => p.id);
  assert.deepEqual(ids({ tag: 'family', color: 'blue' }), ['p1']);
  assert.deepEqual(ids({ tag: 'courier', color: 'blue' }), []);
});
