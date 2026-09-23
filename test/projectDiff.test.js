import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDiffMarkdown, diffProjects } from '../src/utils/projectDiff.js';

const T = '2024-01-01T00:00:00.000Z';
const person = (id, fullName, extra = {}) => ({ id, type: 'name', fields: { fullName }, notes: '', ...extra });
const pin = (id, label, lat, lng, extra = {}) => ({ id, label, address: '', lat, lng, visitedAt: '', withWho: '', notes: '', color: 'red', ...extra });

const before = {
  name: 'Case v1',
  target: { name: 'Jane', notes: '' },
  identifiers: [
    person('a', 'Ann Lee', { notes: 'first', tags: ['family'], color: 'blue' }),
    person('b', 'Bob Roy'),
    { id: 'e1', type: 'email', fields: { address: 'cy@example.com' }, notes: '' },
  ],
  connections: [
    { id: 'c1', source: 'a', target: 'b', label: 'associate of' },
    { id: 'c2', source: 'a', target: 'e1', label: '' },
  ],
  locations: [pin('p1', 'Dublin', 53.3498, -6.2603), pin('p2', 'Oslo', 59.91, 10.75)],
  pinLinks: [{ id: 'l1', pinId: 'p1', identifierId: 'a' }],
  evidence: [
    { id: 'ev1', title: 'Registry hit', text: 'director', source: 'Registry', createdAt: T },
    { id: 'ev2', title: 'Old story', text: 'stale', source: 'News', createdAt: T },
  ],
};

const after = {
  name: 'Case v2',
  target: { name: 'Jane Doe', notes: '' },
  identifiers: [
    person('a', 'Ann Lee', { notes: 'second', tags: ['family', 'courier'], color: 'red' }),
    person('b', 'Bob Roy'),
    person('d', 'Dee New'),
  ],
  connections: [
    { id: 'c1', source: 'a', target: 'b', label: 'brother of' },
    { id: 'c3', source: 'b', target: 'd', label: 'works for' },
  ],
  locations: [pin('p1', 'Dublin HQ', 53.3498, -6.2603, { notes: 'moved office' }), pin('p3', 'Cork', 51.9, -8.47)],
  pinLinks: [{ id: 'l1', pinId: 'p1', identifierId: 'a' }, { id: 'l2', pinId: 'p3', identifierId: 'd' }],
  evidence: [
    { id: 'ev1', title: 'Registry hit', text: 'director', source: 'Registry', createdAt: T },
    { id: 'ev3', title: 'New story', text: 'fresh', source: 'News', createdAt: '2024-03-01T00:00:00.000Z' },
  ],
};

test('reports added, removed, and changed identifiers with readable changes', () => {
  const diff = diffProjects(before, after);
  assert.deepEqual(diff.identifiers.added, ['Dee New (Name)']);
  assert.deepEqual(diff.identifiers.removed, ['cy@example.com (Email)']);
  assert.equal(diff.identifiers.changed.length, 1);
  assert.equal(diff.identifiers.changed[0].title, 'Ann Lee (Name)');
  assert.deepEqual(diff.identifiers.changed[0].changes, ['Notes changed', 'Tags: +courier', 'Colour label: blue → red']);
  assert.equal(diff.identifiers.unchanged, 1);
});

test('reports connection, location, pin link, evidence and project changes', () => {
  const diff = diffProjects(before, after);
  assert.deepEqual(diff.connections.added, ['Bob Roy (Name) — Dee New (Name) [works for]']);
  assert.deepEqual(diff.connections.removed, ['Ann Lee (Name) — cy@example.com (Email)']);
  assert.deepEqual(diff.connections.changed, ['Ann Lee (Name) — Bob Roy (Name): label "associate of" → "brother of"']);

  assert.deepEqual(diff.locations.added, ['Cork']);
  assert.deepEqual(diff.locations.removed, ['Oslo']);
  assert.deepEqual(diff.locations.changed, [{ title: 'Dublin HQ', changes: ['Label: "Dublin" → "Dublin HQ"', 'Notes changed'] }]);

  assert.deepEqual(diff.pinLinks.added, ['Cork ↔ Dee New (Name)']);
  assert.deepEqual(diff.pinLinks.removed, []);

  assert.deepEqual(diff.evidence.added.map((e) => e.title), ['New story']);
  assert.deepEqual(diff.evidence.removed.map((e) => e.title), ['Old story']);

  assert.deepEqual(diff.meta.changes, ['Project name: "Case v1" → "Case v2"', 'Target: "Jane" → "Jane Doe"']);
  assert.equal(diff.identical, false);
});

test('matches identifiers created independently by shared email, phone, or primary value', () => {
  const left = {
    name: 'L',
    identifiers: [
      { id: 'x1', type: 'email', fields: { address: 'jane@example.com' } },
      { id: 'x2', type: 'phone', fields: { number: '+1 555 010 2030' } },
      { id: 'x3', type: 'name', fields: { fullName: 'Jane Doe' } },
    ],
  };
  const right = {
    name: 'R',
    identifiers: [
      { id: 'y1', type: 'email', fields: { address: 'JANE@example.com' } },
      { id: 'y2', type: 'phone', fields: { number: '15550102030' } },
      { id: 'y3', type: 'name', fields: { fullName: 'jane doe', aliases: 'JD' } },
      { id: 'y4', type: 'name', fields: { fullName: 'Someone Else' } },
    ],
  };
  const diff = diffProjects(left, right);
  assert.deepEqual(diff.identifiers.added, ['Someone Else (Name)']);
  assert.deepEqual(diff.identifiers.removed, []);
  const byTitle = Object.fromEntries(diff.identifiers.changed.map((c) => [c.title, c.changes]));
  assert.ok(byTitle['jane doe (Name)'].includes('Aliases / nicknames: (empty) → "JD"'));
});

test('identical projects produce no differences', () => {
  const diff = diffProjects(before, JSON.parse(JSON.stringify(before)));
  assert.equal(diff.identical, true);
  assert.equal(diff.identifiers.unchanged, 3);
  assert.match(buildDiffMarkdown(diff), /No differences found\./);
});

test('markdown diff lists additions, removals, and changes by section', () => {
  const md = buildDiffMarkdown(diffProjects(before, after));
  assert.match(md, /^# Project comparison/);
  assert.match(md, /Earlier: Case v1/);
  assert.match(md, /## Identifiers\n1 added, 1 removed, 1 changed/);
  assert.match(md, /\+ Dee New \(Name\)/);
  assert.match(md, /- cy@example\.com \(Email\)/);
  assert.match(md, /~ Ann Lee \(Name\)\n    Notes changed/);
  assert.match(md, /## Evidence\n1 added, 1 removed, 0 changed/);
  assert.match(md, /\+ 2024-03-01 New story \(News\)/);
});
