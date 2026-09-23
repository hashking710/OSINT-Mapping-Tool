import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_MERGE_OPTIONS, describeMergeSummary, mergeProjects } from '../src/utils/projectMerge.js';
import { validateProject } from '../src/utils/projectIO.js';

const T = '2024-01-01T00:00:00.000Z';
const person = (id, fullName, extra = {}) => ({ id, type: 'name', fields: { fullName }, notes: '', ...extra });
const pin = (id, label, lat, lng, extra = {}) => ({ id, label, address: '', lat, lng, visitedAt: '', withWho: '', notes: '', color: 'red', ...extra });

const base = {
  name: 'Mine',
  identifiers: [
    person('a', 'Ann Lee', { notes: 'mine', tags: ['family'], color: 'blue', position: { x: 5, y: 5 } }),
    person('b', 'Bob Roy'),
    { id: 'e1', type: 'email', fields: { address: 'cy@example.com' }, notes: '' },
  ],
  connections: [{ id: 'c1', source: 'a', target: 'b', label: 'associate of' }],
  locations: [pin('p1', 'Dublin', 53.3498, -6.2603), pin('p2', 'Oslo', 59.91, 10.75)],
  pinLinks: [{ id: 'l1', pinId: 'p1', identifierId: 'a', context: '' }],
  evidence: [{ id: 'ev1', title: 'Registry hit', text: 'director', source: 'Registry', createdAt: T }],
  filterPresets: [{ id: 'v0', name: 'Mine', query: '', tag: null, color: null }],
};

const incoming = {
  name: 'Theirs',
  identifiers: [
    person('a', 'Ann Lee', { notes: 'theirs', tags: ['courier'], color: 'red' }),
    person('b', 'Bob Roy'),
    person('d', 'Dee New', { tags: ['work'] }),
  ],
  connections: [
    { id: 'c1', source: 'a', target: 'b', label: 'brother of' },
    { id: 'c3', source: 'b', target: 'd', label: 'works for' },
  ],
  locations: [pin('p1', 'Dublin HQ', 53.3498, -6.2603, { notes: 'new office' }), pin('p3', 'Cork', 51.9, -8.47)],
  pinLinks: [
    { id: 'l1', pinId: 'p1', identifierId: 'a', context: '' },
    { id: 'l2', pinId: 'p3', identifierId: 'd', context: 'lives here' },
  ],
  evidence: [
    { id: 'ev1', title: 'Registry hit', text: 'director', source: 'Registry', createdAt: T },
    { id: 'ev3', title: 'New story', text: 'fresh', source: 'News', createdAt: '2024-03-01T00:00:00.000Z' },
  ],
  filterPresets: [
    { id: 'w1', name: 'Mine', query: 'x', tag: null, color: null },
    { id: 'w2', name: 'Work', query: '', tag: 'work', color: null },
  ],
};

test('default merge only adds new things and never deletes or overwrites', () => {
  const { project, summary, total } = mergeProjects(base, incoming);
  assert.deepEqual(project.identifiers.map((i) => i.id), ['a', 'b', 'e1', 'd']);
  assert.equal(project.identifiers[0].notes, 'mine');
  assert.deepEqual(project.identifiers[0].tags, ['family']);
  assert.deepEqual(project.identifiers[3].position, { x: 60 + 3 * 240, y: 60 });
  assert.equal(project.identifiers[3].fields.fullName, 'Dee New');

  assert.equal(project.connections.length, 2);
  assert.equal(project.connections[0].label, 'associate of');
  const added = project.connections[1];
  assert.deepEqual([added.source, added.target, added.label], ['b', 'd', 'works for']);

  assert.deepEqual(project.locations.map((l) => l.label), ['Dublin', 'Oslo', 'Cork']);
  assert.equal(project.pinLinks.length, 2);
  assert.deepEqual([project.pinLinks[1].pinId, project.pinLinks[1].identifierId, project.pinLinks[1].context], ['p3', 'd', 'lives here']);
  assert.deepEqual(project.evidence.map((e) => e.id), ['ev1', 'ev3']);
  assert.deepEqual(project.filterPresets.map((p) => p.name), ['Mine', 'Work']);
  assert.equal(project.name, 'Mine');

  assert.deepEqual(summary.added, { identifiers: 1, connections: 1, locations: 1, pinLinks: 1, evidence: 1, views: 1 });
  assert.deepEqual(summary.updated, { identifiers: 0, connections: 0, locations: 0 });
  assert.equal(total, 6);
});

test('updateChanged applies edits from the file, merging tags instead of replacing them', () => {
  const { project, summary } = mergeProjects(base, incoming, { updateChanged: true });
  const ann = project.identifiers.find((i) => i.id === 'a');
  assert.equal(ann.notes, 'theirs');
  assert.equal(ann.color, 'red');
  assert.deepEqual(ann.tags, ['family', 'courier']);
  assert.deepEqual(ann.position, { x: 5, y: 5 });
  assert.equal(project.connections[0].label, 'brother of');
  assert.equal(project.locations[0].label, 'Dublin HQ');
  assert.equal(project.locations[0].notes, 'new office');
  assert.deepEqual(summary.updated, { identifiers: 1, connections: 1, locations: 1 });
});

test('turning a category off skips it and anything that depends on it', () => {
  const { project, summary } = mergeProjects(base, incoming, { identifiers: false });
  assert.equal(project.identifiers.length, 3);
  assert.equal(project.connections.length, 1);
  assert.equal(project.pinLinks.length, 1);
  assert.equal(summary.added.identifiers, 0);
  assert.equal(summary.added.connections, 0);
  assert.equal(summary.added.pinLinks, 0);
  assert.equal(summary.added.locations, 1);

  const none = mergeProjects(base, incoming, { identifiers: false, connections: false, locations: false, evidence: false, views: false });
  assert.equal(none.total, 0);
});

test('merging is idempotent and does not modify its inputs', () => {
  const before = JSON.stringify([base, incoming]);
  const once = mergeProjects(base, incoming, ALL_MERGE_OPTIONS);
  assert.equal(JSON.stringify([base, incoming]), before);
  const twice = mergeProjects(once.project, incoming, ALL_MERGE_OPTIONS);
  assert.equal(twice.total, 0);
  assert.equal(twice.project.identifiers.length, once.project.identifiers.length);
});

test('independently created items are matched by shared values, not duplicated', () => {
  const mine = { name: 'A', identifiers: [{ id: 'x1', type: 'email', fields: { address: 'jane@example.com' } }] };
  const theirs = {
    name: 'B',
    identifiers: [
      { id: 'y1', type: 'email', fields: { address: 'JANE@example.com' } },
      { id: 'y2', type: 'phone', fields: { number: '+1 555 010 2030' } },
    ],
  };
  const { project, summary } = mergeProjects(mine, theirs);
  assert.deepEqual(project.identifiers.map((i) => i.id), ['x1', 'y2']);
  assert.equal(summary.added.identifiers, 1);
  assert.ok(validateProject(project));
});

test('describes what a merge did in plain words', () => {
  assert.equal(
    describeMergeSummary(mergeProjects(base, incoming, ALL_MERGE_OPTIONS).summary),
    '+1 identifier, +1 connection, +1 location, +1 pin link, +1 evidence entry, +1 saved view, 3 updated',
  );
  assert.equal(describeMergeSummary(mergeProjects(base, base).summary), 'nothing to merge');
});
