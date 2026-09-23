import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LABEL_COLORS,
  addTags,
  collectColors,
  collectTags,
  filterIdentifiersByLabels,
  normalizeColor,
  normalizeTags,
  removeTags,
} from '../src/utils/identifierLabels.js';
import { filterIdentifiersForQuery } from '../src/utils/identifierSearch.js';

test('normalizes tags from strings and arrays, deduping case-insensitively', () => {
  assert.deepEqual(normalizeTags(' Family ,  suspect; family ,, Key  Contact '), ['Family', 'suspect', 'Key Contact']);
  assert.deepEqual(normalizeTags(['a', 'A', ' b ', '', null]), ['a', 'b']);
  assert.deepEqual(normalizeTags(undefined), []);
  assert.equal(normalizeTags('x'.repeat(80))[0].length, 30);
  assert.equal(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 12);
});

test('only palette colours are accepted, and white/black are excluded', () => {
  assert.equal(normalizeColor('red'), 'red');
  assert.equal(normalizeColor('white'), null);
  assert.equal(normalizeColor('#ff0000'), null);
  assert.ok(LABEL_COLORS.length >= 6);
});

test('collects tags by usage and colours in palette order', () => {
  const identifiers = [
    { id: '1', tags: ['Family', 'target'], color: 'blue' },
    { id: '2', tags: ['family'], color: 'red' },
    { id: '3', tags: ['zeta'] },
    { id: '4', color: 'blue' },
  ];
  assert.deepEqual(collectTags(identifiers), [
    { tag: 'Family', count: 2 },
    { tag: 'target', count: 1 },
    { tag: 'zeta', count: 1 },
  ]);
  assert.deepEqual(collectColors(identifiers), ['red', 'blue']);
});

test('filters identifiers by tag and colour together', () => {
  const identifiers = [
    { id: '1', tags: ['family'], color: 'blue' },
    { id: '2', tags: ['Family'], color: 'red' },
    { id: '3', tags: [], color: 'blue' },
  ];
  assert.deepEqual(filterIdentifiersByLabels(identifiers, { tag: 'FAMILY' }).map((i) => i.id), ['1', '2']);
  assert.deepEqual(filterIdentifiersByLabels(identifiers, { color: 'blue' }).map((i) => i.id), ['1', '3']);
  assert.deepEqual(filterIdentifiersByLabels(identifiers, { tag: 'family', color: 'blue' }).map((i) => i.id), ['1']);
  assert.equal(filterIdentifiersByLabels(identifiers, {}).length, 3);
});

test('adds and removes tags without duplicating or being case sensitive', () => {
  assert.deepEqual(addTags(['a'], 'A, b'), ['a', 'b']);
  assert.deepEqual(removeTags(['Alpha', 'beta'], 'ALPHA'), ['beta']);
  assert.deepEqual(removeTags(undefined, 'x'), []);
});

test('identifier text search also matches tags', () => {
  const identifiers = [
    { id: '1', type: 'name', fields: { fullName: 'Jane' }, tags: ['courier'] },
    { id: '2', type: 'name', fields: { fullName: 'Bob' }, tags: [] },
  ];
  assert.deepEqual(filterIdentifiersForQuery(identifiers, 'courier').map((i) => i.id), ['1']);
});

test('tags and colour round-trip through the CSV export, import, and report', async () => {
  const { buildIdentifiersCsv } = await import('../src/utils/exportCsv.js');
  const { identifiersFromCsv } = await import('../src/utils/importCsv.js');
  const { buildCaseReport } = await import('../src/utils/caseReport.js');
  const project = {
    name: 'Labels',
    identifiers: [
      { id: 'i1', type: 'name', fields: { fullName: 'Jane Doe' }, tags: ['family', 'Key contact'], color: 'blue' },
      { id: 'i2', type: 'email', fields: { address: 'jane@example.com' }, tags: [], color: 'nonsense' },
    ],
    connections: [],
    locations: [],
    pinLinks: [],
    evidence: [],
  };
  const csv = buildIdentifiersCsv(project);
  assert.match(csv, /family; Key contact,blue/);

  const { records } = identifiersFromCsv(csv);
  assert.deepEqual(records[0].tags, ['family', 'Key contact']);
  assert.equal(records[0].color, 'blue');
  assert.deepEqual(records[1].tags, []);
  assert.equal(records[1].color, null);

  const report = buildCaseReport(project);
  assert.match(report, /- Tags: family, Key contact/);
  assert.match(report, /- Colour label: blue/);
});
