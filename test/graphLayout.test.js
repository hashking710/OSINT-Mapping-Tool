import assert from 'node:assert/strict';
import test from 'node:test';
import { computeLayout } from '../src/utils/graphLayout.js';

const ids = (...list) => list.map((id) => ({ id }));

test('gives every identifier a unique position', () => {
  const identifiers = ids('a', 'b', 'c', 'd', 'e', 'f');
  const connections = [
    { id: '1', source: 'a', target: 'b' },
    { id: '2', source: 'a', target: 'c' },
    { id: '3', source: 'c', target: 'd' },
  ];
  const layout = computeLayout(identifiers, connections);
  assert.equal(layout.size, identifiers.length);
  const keys = [...layout.values()].map((p) => `${p.x},${p.y}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('places connected nodes in successive columns rooted at the hub', () => {
  const layout = computeLayout(ids('hub', 'x', 'y'), [
    { id: '1', source: 'hub', target: 'x' },
    { id: '2', source: 'hub', target: 'y' },
  ]);
  assert.ok(layout.get('x').x > layout.get('hub').x);
  assert.equal(layout.get('x').x, layout.get('y').x);
});

test('puts unconnected identifiers below connected components', () => {
  const layout = computeLayout(ids('a', 'b', 'lone'), [{ id: '1', source: 'a', target: 'b' }]);
  assert.ok(layout.get('lone').y > layout.get('a').y);
  assert.ok(layout.get('lone').y > layout.get('b').y);
});

test('ignores connections that reference missing identifiers', () => {
  const layout = computeLayout(ids('a'), [{ id: '1', source: 'a', target: 'ghost' }]);
  assert.equal(layout.size, 1);
});
