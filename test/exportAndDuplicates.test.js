import assert from 'node:assert/strict';
import test from 'node:test';
import { findDuplicateIdentifiers, normalizeIdentityValue } from '../src/utils/duplicates.js';
import {
  buildEvidenceCsv,
  buildIdentifiersCsv,
  buildLocationsCsv,
  csvCell,
} from '../src/utils/exportCsv.js';

const project = {
  name: 'Export case',
  identifiers: [
    { id: 'i1', type: 'name', fields: { fullName: 'Jane Doe' }, notes: 'Subject, primary' },
    { id: 'i2', type: 'email', fields: { address: 'Jane@Example.com' } },
    { id: 'i3', type: 'phone', fields: { number: '+1 (555) 010-2030' } },
  ],
  connections: [{ id: 'c1', source: 'i1', target: 'i2', label: 'uses' }],
  locations: [{ id: 'l1', lat: -6.2603, lng: 53.3498, label: 'Office', address: '1 Main St' }],
  pinLinks: [{ id: 'p1', pinId: 'l1', identifierId: 'i1', context: '' }],
  evidence: [
    {
      id: 'e1',
      title: '=SUM(A1)',
      text: 'said "hello"',
      source: 'Note',
      createdAt: '2024-02-01T00:00:00.000Z',
    },
  ],
};

test('csvCell quotes special characters and neutralises formulas but keeps numbers', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell(-6.26), '-6.26');
  assert.equal(csvCell(null), '');
});

test('identifiers CSV includes details, relationships, and linked pins', () => {
  const csv = buildIdentifiersCsv(project);
  const [header, ...rows] = csv.trim().split('\r\n');
  assert.equal(header, 'Type,Label,Details,Notes,Tags,Colour,Connected to,Linked locations,Created');
  assert.equal(rows.length, 3);
  assert.match(rows[0], /Jane Doe \(Name\)/);
  assert.match(rows[0], /Full name: Jane Doe/);
  assert.match(rows[0], /"Subject, primary"/);
  assert.match(rows[0], /Jane@Example\.com \(Email\) \[uses\]/);
  assert.match(rows[0], /Office/);
});

test('locations and evidence CSVs are well formed', () => {
  assert.match(buildLocationsCsv(project), /Office,1 Main St,-6\.2603,53\.3498/);
  const evidence = buildEvidenceCsv(project);
  assert.match(evidence, /2024-02-01,'=SUM\(A1\)/);
  assert.match(evidence, /"said ""hello"""/);
});

test('normalizes phones to digits and strips handle prefixes', () => {
  assert.equal(normalizeIdentityValue('+1 (555) 010-2030', 'tel'), '15550102030');
  assert.equal(normalizeIdentityValue('123', 'tel'), '');
  assert.equal(normalizeIdentityValue(' @JaneDoe ', 'text'), 'janedoe');
});

test('finds duplicate emails across types and phones in different formats', () => {
  const existing = [
    { id: 'a', type: 'email', fields: { address: 'jane@example.com' } },
    { id: 'b', type: 'phone', fields: { number: '15550102030' } },
    { id: 'c', type: 'instagram', fields: { username: 'jane' } },
  ];
  const viaLinkedEmail = findDuplicateIdentifiers(existing, {
    type: 'instagram',
    fields: { username: 'other', email: 'JANE@example.com' },
  });
  assert.equal(viaLinkedEmail.length, 1);
  assert.equal(viaLinkedEmail[0].identifier.id, 'a');

  const phone = findDuplicateIdentifiers(existing, {
    type: 'phone',
    fields: { number: '+1 555 010 2030' },
  });
  assert.equal(phone[0].identifier.id, 'b');
});

test('same handle on a different platform is not a duplicate, same platform is', () => {
  const existing = [{ id: 'c', type: 'instagram', fields: { username: '@jane' } }];
  assert.equal(
    findDuplicateIdentifiers(existing, { type: 'twitter', fields: { username: 'jane' } }).length,
    0,
  );
  assert.equal(
    findDuplicateIdentifiers(existing, { type: 'instagram', fields: { username: 'Jane' } }).length,
    1,
  );
});

test('ignores the identifier being edited', () => {
  const existing = [{ id: 'a', type: 'email', fields: { address: 'jane@example.com' } }];
  const self = { id: 'a', type: 'email', fields: { address: 'jane@example.com' } };
  assert.equal(findDuplicateIdentifiers(existing, self, { ignoreId: 'a' }).length, 0);
});

test('filters evidence across title, text, and source with all terms required', async () => {
  const { filterEvidence } = await import('../src/utils/evidenceSearch.js');
  const entries = [
    { id: '1', title: 'Company filing', text: 'Registered in Dublin', source: 'Registry' },
    { id: '2', title: 'Photo', text: 'Seen near the port', source: 'Analyst note' },
  ];
  assert.equal(filterEvidence(entries, '').length, 2);
  assert.deepEqual(filterEvidence(entries, 'dublin registry').map((e) => e.id), ['1']);
  assert.deepEqual(filterEvidence(entries, 'ANALYST').map((e) => e.id), ['2']);
  assert.equal(filterEvidence(entries, 'nothing').length, 0);
});
