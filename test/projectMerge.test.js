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

test('planMerge lists every candidate change with keys, labels, and dependencies', async () => {
  const { planMerge } = await import('../src/utils/projectMerge.js');
  const plan = planMerge(base, incoming);
  const byKey = Object.fromEntries(plan.map((item) => [item.key, item]));
  assert.deepEqual(Object.keys(byKey).sort(), [
    'c:c3', 'cu:c1', 'e:ev3', 'i:d', 'l:p3', 'lu:p1:label', 'lu:p1:notes', 'p:l2', 'u:a:color', 'u:a:notes', 'u:a:tags', 'v:work',
  ]);

  assert.deepEqual([byKey['i:d'].category, byKey['i:d'].kind, byKey['i:d'].label], ['identifiers', 'add', 'Dee New (Name)']);
  assert.equal(byKey['u:a:notes'].text, 'Notes: "mine" \u2192 "theirs"');
  assert.equal(byKey['u:a:tags'].text, 'Tags: +courier');
  assert.equal(byKey['u:a:color'].text, 'Colour label: blue \u2192 red');
  assert.equal(byKey['u:a:notes'].fieldLabel, 'Notes');
  assert.deepEqual(byKey['u:a:notes'].group, { key: 'u:a', label: 'Ann Lee (Name)' });
  assert.equal(byKey['u:a:color'].group.key, byKey['u:a:tags'].group.key);
  assert.deepEqual(byKey['c:c3'].needs, ['i:d']);
  assert.equal(byKey['c:c3'].label, 'Bob Roy (Name) \u2014 Dee New (Name) [works for]');
  assert.deepEqual(byKey['p:l2'].needs.sort(), ['i:d', 'l:p3']);
  assert.equal(byKey['p:l2'].label, 'Cork \u2194 Dee New (Name)');
  assert.deepEqual(byKey['cu:c1'].changes, ['Label: "associate of" \u2192 "brother of"']);
  assert.equal(byKey['lu:p1:label'].text, 'Label: "Dublin" \u2192 "Dublin HQ"');
  assert.equal(byKey['lu:p1:notes'].text, 'Notes: (empty) \u2192 "new office"');
  assert.equal(byKey['e:ev3'].label, '2024-03-01 New story (News)');
  assert.equal(plan.every((item) => !('payload' in item)), true);
});

test('merging exact items: dependencies are enforced and keep-mine / take-theirs is per item', async () => {
  const { resolveSelection, planMerge } = await import('../src/utils/projectMerge.js');

  const onlyEvidence = mergeProjects(base, incoming, { keys: new Set(['e:ev3']) });
  assert.equal(onlyEvidence.total, 1);
  assert.deepEqual(onlyEvidence.project.evidence.map((e) => e.id), ['ev1', 'ev3']);
  assert.equal(onlyEvidence.project.identifiers.length, 3);

  const orphan = mergeProjects(base, incoming, { keys: new Set(['c:c3']) });
  assert.equal(orphan.total, 0);

  const together = mergeProjects(base, incoming, { keys: new Set(['i:d', 'c:c3', 'p:l2']) });
  assert.equal(together.summary.added.identifiers, 1);
  assert.equal(together.summary.added.connections, 1);
  assert.equal(together.summary.added.pinLinks, 0);

  const withPin = mergeProjects(base, incoming, { keys: new Set(['i:d', 'l:p3', 'p:l2']) });
  assert.equal(withPin.summary.added.pinLinks, 1);

  // Take theirs for Ann only; keep mine for the connection label and the pin.
  const takeAnn = mergeProjects(base, incoming, { keys: new Set(['u:a:notes']) });
  const annAfter = takeAnn.project.identifiers.find((i) => i.id === 'a');
  assert.equal(annAfter.notes, 'theirs');
  assert.equal(annAfter.color, 'blue');
  assert.deepEqual(annAfter.tags, ['family']);
  assert.equal(takeAnn.project.connections[0].label, 'associate of');
  assert.equal(takeAnn.project.locations[0].label, 'Dublin');
  assert.deepEqual(takeAnn.summary.updated, { identifiers: 1, connections: 0, locations: 0 });

  const items = planMerge(base, incoming);
  assert.deepEqual([...resolveSelection(items, ['c:c3', 'e:ev3'])], ['e:ev3']);
  assert.deepEqual([...resolveSelection(items, ['c:c3', 'i:d'])].sort(), ['c:c3', 'i:d']);
});

test('merge history is kept in project files, sanitised, and shown in reports', async () => {
  const { validateProject } = await import('../src/utils/projectIO.js');
  const { buildCaseReport, buildCaseReportHtml } = await import('../src/utils/caseReport.js');
  const project = validateProject({
    name: 'Logged <case>',
    mergeLog: [
      { id: 'm1', at: '2025-02-03T10:00:00.000Z', source: 'colleague<b>.json', text: '+1 identifier', total: 1 },
      { id: 'bad' },
      null,
    ],
  });
  assert.equal(project.mergeLog.length, 1);
  assert.equal(project.mergeLog[0].total, 1);
  assert.deepEqual(validateProject({ name: 'Old' }).mergeLog, []);

  const md = buildCaseReport(project);
  assert.match(md, /## Merge history\n- 2025-02-03 from colleague<b>\.json: \+1 identifier/);
  assert.doesNotMatch(buildCaseReport({ name: 'None' }), /Merge history/);
  const html = buildCaseReportHtml(project);
  assert.match(html, /<h2>Merge history<\/h2>/);
  assert.match(html, /from colleague&lt;b&gt;\.json/);

  const many = validateProject({
    name: 'Many',
    mergeLog: Array.from({ length: 80 }, (_, i) => ({ id: `m${i}`, at: '2025-01-01T00:00:00.000Z', text: 't' })),
  });
  assert.equal(many.mergeLog.length, 50);
  assert.equal(many.mergeLog[0].id, 'm30');
});

test('changed items can be merged one property at a time', async () => {
  const mine = {
    name: 'Mine',
    identifiers: [
      { id: 'a', type: 'name', fields: { fullName: 'Ann Lee', aliases: 'AL' }, notes: 'my notes', tags: ['family'], color: 'blue' },
    ],
    locations: [{ id: 'p1', lat: 1, lng: 2, label: 'Depot', address: '1 Main St', visitedAt: '', withWho: '', notes: '', color: 'red' }],
  };
  const theirs = {
    name: 'Theirs',
    identifiers: [
      { id: 'a', type: 'name', fields: { fullName: 'Ann Lee', aliases: 'AL; Annie' }, notes: 'their notes', tags: ['courier'], color: 'red' },
    ],
    locations: [{ id: 'p1', lat: 1.5, lng: 2.5, label: 'Depot', address: '2 Side St', visitedAt: '', withWho: '', notes: '', color: 'red' }],
  };
  const { planMerge } = await import('../src/utils/projectMerge.js');
  const keys = planMerge(mine, theirs).map((i) => i.key).sort();
  assert.deepEqual(keys, ['lu:p1:address', 'lu:p1:coords', 'u:a:color', 'u:a:f:aliases', 'u:a:notes', 'u:a:tags']);

  // Take their notes but keep my tags and colour.
  const notesOnly = mergeProjects(mine, theirs, { keys: new Set(['u:a:notes']) });
  const ann = notesOnly.project.identifiers[0];
  assert.deepEqual([ann.notes, ann.tags, ann.color, ann.fields.aliases], ['their notes', ['family'], 'blue', 'AL']);
  assert.deepEqual(notesOnly.summary.updated, { identifiers: 1, connections: 0, locations: 0 });

  // Two properties of the same identifier still count as one updated identifier.
  const two = mergeProjects(mine, theirs, { keys: new Set(['u:a:f:aliases', 'u:a:tags']) });
  assert.deepEqual([two.project.identifiers[0].fields.aliases, two.project.identifiers[0].tags], ['AL; Annie', ['family', 'courier']]);
  assert.equal(two.summary.updated.identifiers, 1);

  // Position moves independently of the address.
  const moved = mergeProjects(mine, theirs, { keys: new Set(['lu:p1:coords']) });
  assert.deepEqual([moved.project.locations[0].lat, moved.project.locations[0].lng, moved.project.locations[0].address], [1.5, 2.5, '1 Main St']);

  // The blanket switch still takes everything.
  const all = mergeProjects(mine, theirs, { updateChanged: true, identifiers: false });
  assert.equal(all.project.identifiers[0].notes, 'their notes');
  assert.equal(all.project.locations[0].address, '2 Side St');
});

test('several files combine in order, later files winning where they disagree', async () => {
  const { combineProjects } = await import('../src/utils/projectMerge.js');
  const one = { name: 'One', identifiers: [{ id: 'a', type: 'name', fields: { fullName: 'Ann' }, notes: 'from one' }], evidence: [{ id: 'e1', title: 'T1', text: 'x', source: 'S' }] };
  const two = { name: 'Two', identifiers: [{ id: 'a', type: 'name', fields: { fullName: 'Ann' }, notes: 'from two' }, { id: 'b', type: 'name', fields: { fullName: 'Bob' } }], evidence: [{ id: 'e2', title: 'T2', text: 'y', source: 'S' }] };
  const three = { name: 'Three', identifiers: [{ id: 'c', type: 'email', fields: { address: 'c@example.com' } }] };

  assert.equal(combineProjects([]), null);
  assert.equal(combineProjects([one]).name, 'One');
  const combined = combineProjects([one, two, three]);
  assert.equal(combined.name, 'One');
  assert.deepEqual(combined.identifiers.map((i) => i.id), ['a', 'b', 'c']);
  assert.equal(combined.identifiers[0].notes, 'from two');
  assert.deepEqual(combined.evidence.map((e) => e.id), ['e1', 'e2']);
  assert.equal(combineProjects([two, one]).identifiers[0].notes, 'from one');
});
