import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceForIdentifier } from '../src/utils/evidenceLinks.js';
import { buildIdentifiersCsv } from '../src/utils/exportCsv.js';
import { identifiersFromCsv, parseCsv } from '../src/utils/importCsv.js';
import { reorderById, sortPins } from '../src/utils/pinOrder.js';

test('parseCsv handles quotes, embedded commas and newlines, CRLF, and BOM', () => {
  const rows = parseCsv('\uFEFFa,b\r\n"x, y","say ""hi""\nthere"\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'say "hi"\nthere']]);
});

test('imports a simple hand-made sheet and reports skipped rows', () => {
  const csv = [
    'Type,Value,Notes',
    'Email,jane@example.com,personal',
    'Phone,+1 555 010 2030,',
    'Instagram,@janedoe,',
    'Email,JANE@example.com,dupe of first',
    'Email,,no value',
    ',,',
    'Boat,Sea Breeze,unknown type becomes custom',
  ].join('\n');
  const { records, skipped, error } = identifiersFromCsv(csv);
  assert.equal(error, null);
  assert.deepEqual(records.map((r) => r.type), ['email', 'phone', 'instagram', 'custom']);
  assert.equal(records[0].fields.address, 'jane@example.com');
  assert.equal(records[2].fields.username, '@janedoe');
  assert.equal(records[3].fields.title, 'Sea Breeze');
  assert.deepEqual(skipped.map((s) => s.reason), ['duplicate', 'missing value']);
});

test('skips rows that duplicate identifiers already in the project', () => {
  const existing = [{ id: 'a', type: 'email', fields: { address: 'jane@example.com' } }];
  const { records, skipped } = identifiersFromCsv('Type,Value\nEmail,jane@example.com\nEmail,new@example.com', existing);
  assert.equal(records.length, 1);
  assert.equal(skipped[0].reason, 'duplicate');
});

test('round-trips the identifiers CSV export', () => {
  const project = {
    name: 'Round trip',
    identifiers: [
      { id: 'i1', type: 'name', fields: { fullName: 'Jane Doe', aliases: 'JD; Janey' }, notes: 'Subject, primary' },
      { id: 'i2', type: 'email', fields: { address: 'jane@example.com', provider: 'Gmail' } },
      { id: 'i3', type: 'custom', fields: { title: '=HYPERLINK("x")' } },
    ],
    connections: [{ id: 'c1', source: 'i1', target: 'i2', label: 'uses' }],
    locations: [],
    pinLinks: [],
    evidence: [],
  };
  const { records, skipped, error } = identifiersFromCsv(buildIdentifiersCsv(project));
  assert.equal(error, null);
  assert.equal(skipped.length, 0);
  assert.equal(records[0].fields.fullName, 'Jane Doe');
  assert.equal(records[0].fields.aliases, 'JD; Janey');
  assert.equal(records[0].notes, 'Subject, primary');
  assert.equal(records[1].fields.address, 'jane@example.com');
  assert.equal(records[1].fields.provider, 'Gmail');
  assert.equal(records[2].fields.title, '=HYPERLINK("x")');
});

test('rejects files without recognisable columns', () => {
  assert.match(identifiersFromCsv('foo,bar\n1,2').error, /Type|Label/);
  assert.match(identifiersFromCsv('Type,Value').error, /no data rows/);
});

test('sorts pins by visited date with undated pins last, and by name', () => {
  const pins = [
    { id: 'a', label: 'Zulu', visitedAt: '2024-05-01' },
    { id: 'b', label: 'Alpha' },
    { id: 'c', label: 'Mike', visitedAt: '2023-01-10' },
    { id: 'd', label: 'Bravo', visitedAt: 'sometime' },
  ];
  assert.deepEqual(sortPins(pins, 'visited').map((p) => p.id), ['c', 'a', 'b', 'd']);
  assert.deepEqual(sortPins(pins, 'name').map((p) => p.id), ['b', 'd', 'c', 'a']);
  assert.deepEqual(sortPins(pins, 'added'), pins);
});

test('reorderById moves an item into another slot without mutating', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(reorderById(items, 'a', 'c').map((i) => i.id), ['b', 'c', 'a']);
  assert.deepEqual(reorderById(items, 'c', 'a').map((i) => i.id), ['c', 'a', 'b']);
  assert.equal(reorderById(items, 'a', 'a'), items);
  assert.deepEqual(items.map((i) => i.id), ['a', 'b', 'c']);
});

test('finds evidence for an identifier by lookup context or mentioned value', () => {
  const identifier = { id: 'i1', type: 'email', fields: { address: 'jane@example.com' } };
  const evidence = [
    { id: '1', title: 'Breach hit', text: 'jane@example.com appeared', context: '' },
    { id: '2', title: 'Lookup', text: 'nothing here', context: 'identifier:i1' },
    { id: '3', title: 'Other', text: 'unrelated', context: 'identifier:zzz' },
  ];
  assert.deepEqual(evidenceForIdentifier(evidence, identifier).map((e) => e.id), ['1', '2']);
  const bare = { id: 'i9', type: 'email', fields: {} };
  assert.equal(evidenceForIdentifier([{ id: 'x', title: 'Email', text: 'email', context: '' }], bare).length, 0);
});
