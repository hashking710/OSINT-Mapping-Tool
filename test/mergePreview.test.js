import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMergePreview } from '../src/utils/mergePreview.js';
import { mergeProjects } from '../src/utils/projectMerge.js';

const person = (id, fullName, extra = {}) => ({ id, type: 'name', fields: { fullName }, notes: '', ...extra });

const base = {
  name: 'Base',
  identifiers: [person('a', 'Ann Lee', { notes: 'mine', color: 'blue' }), person('b', 'Bob Roy')],
  connections: [{ id: 'c1', source: 'a', target: 'b', label: 'associate of' }],
};
const incoming = {
  name: 'Theirs',
  identifiers: [person('a', 'Ann Lee', { notes: 'theirs', color: 'blue' }), person('b', 'Bob Roy'), person('d', 'Dee New')],
  connections: [
    { id: 'c1', source: 'a', target: 'b', label: 'brother of' },
    { id: 'c3', source: 'b', target: 'd', label: 'works for' },
  ],
};

test('classifies nodes and connections of the merged result as new, changed, or unchanged', () => {
  const merged = mergeProjects(base, incoming, { updateChanged: true }).project;
  const preview = buildMergePreview(base, merged);
  const status = Object.fromEntries(preview.nodes.map((n) => [n.label, n.status]));
  assert.deepEqual(status, { 'Ann Lee': 'updated', 'Bob Roy': 'same', 'Dee New': 'added' });
  assert.deepEqual(preview.counts, { addedNodes: 1, updatedNodes: 1, addedEdges: 1, updatedEdges: 1 });
  const edges = Object.fromEntries(preview.edges.map((e) => [e.label, e.status]));
  assert.deepEqual(edges, { 'brother of': 'updated', 'works for': 'added' });
  assert.equal(preview.nodes.find((n) => n.label === 'Ann Lee').color, 'blue');
  assert.equal(preview.nodes.find((n) => n.label === 'Ann Lee').type, 'Name');
});

test('an unchanged merge previews everything as unchanged, and positions never collide', () => {
  const same = buildMergePreview(base, base);
  assert.equal(same.nodes.every((n) => n.status === 'same'), true);
  assert.equal(same.edges.every((e) => e.status === 'same'), true);

  const merged = mergeProjects(base, incoming).project;
  const preview = buildMergePreview(base, merged);
  const spots = preview.nodes.map((n) => `${n.x},${n.y}`);
  assert.equal(new Set(spots).size, spots.length);
  assert.ok(preview.bounds.width > 0 && preview.bounds.height > 0);
  for (const n of preview.nodes) {
    assert.ok(n.x >= preview.bounds.x && n.y >= preview.bounds.y);
  }
});

test('a project with no identifiers still yields usable bounds', () => {
  const empty = buildMergePreview({ name: 'A' }, { name: 'B' });
  assert.deepEqual(empty.nodes, []);
  assert.ok(empty.bounds.width > 0);
});
