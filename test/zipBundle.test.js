import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportBundleFiles, buildReportBundleZip } from '../src/utils/bundle.js';
import { createZip, crc32, readZipEntries } from '../src/utils/zip.js';

const decode = (bytes) => new TextDecoder().decode(bytes);

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('zip round-trips text, unicode names and binary data with verified checksums', () => {
  const binary = Uint8Array.from({ length: 300 }, (_, i) => i % 256);
  const zip = createZip(
    [
      { name: 'a.txt', content: 'hello' },
      { name: 'dossiers/caf\u00e9-\u5f20.md', content: '# caf\u00e9\n' },
      { name: 'data.bin', content: binary },
      { name: 'empty.txt', content: '' },
    ],
    new Date('2025-03-04T05:06:07'),
  );
  const entries = readZipEntries(zip);
  assert.deepEqual(entries.map((e) => e.name), ['a.txt', 'dossiers/caf\u00e9-\u5f20.md', 'data.bin', 'empty.txt']);
  assert.equal(decode(entries[0].data), 'hello');
  assert.equal(decode(entries[1].data), '# caf\u00e9\n');
  assert.deepEqual([...entries[2].data], [...binary]);
  assert.equal(entries[3].data.length, 0);

  const corrupted = new Uint8Array(zip);
  corrupted[35] ^= 0xff; // first byte of a.txt's data
  assert.throws(() => readZipEntries(corrupted), /Checksum mismatch|Corrupt|Unsupported/);
  assert.throws(() => readZipEntries(new Uint8Array(10)), /Not a ZIP/);
});

const project = {
  name: 'Bundle <case>',
  target: { name: 'Jane', notes: '' },
  identifiers: [
    { id: 'i1', type: 'name', fields: { fullName: 'Jane Doe' }, tags: ['family'], color: 'blue' },
    { id: 'i2', type: 'name', fields: { fullName: 'Bob Roy' } },
  ],
  connections: [],
  locations: [{ id: 'l1', lat: 1, lng: 2, label: 'Depot' }],
  pinLinks: [],
  evidence: [{ id: 'e1', title: 'Registry hit', text: 'Jane Doe is a director', source: 'Registry', createdAt: '2024-01-01T00:00:00.000Z' }],
  filterPresets: [{ id: 'v1', name: 'Family', query: '', tag: 'family', color: null }],
};

test('report bundle contains the report, data files, per-identifier dossiers, views and project', () => {
  const generatedAt = new Date('2025-02-03T00:00:00Z');
  const names = buildReportBundleFiles(project, { generatedAt }).map((f) => f.name);
  assert.deepEqual(names, [
    'README.txt',
    'case-report.html',
    'case-report.md',
    'identifiers.csv',
    'locations.csv',
    'evidence.csv',
    'dossiers/01-jane_doe_name.md',
    'saved-views.json',
    'project.osint.json',
  ]);

  const entries = Object.fromEntries(readZipEntries(buildReportBundleZip(project, { generatedAt })).map((e) => [e.name, decode(e.data)]));
  assert.match(entries['README.txt'], /Generated 2025-02-03/);
  assert.match(entries['case-report.html'], /Bundle &lt;case&gt;/);
  assert.match(entries['case-report.md'], /^# Case report: Bundle <case>/);
  assert.match(entries['dossiers/01-jane_doe_name.md'], /Jane Doe is a director/);
  assert.equal(JSON.parse(entries['project.osint.json']).name, 'Bundle <case>');
  assert.equal(JSON.parse(entries['saved-views.json']).views[0].name, 'Family');
});

test('bundles omit saved views and dossiers when there is nothing to put in them', () => {
  const bare = { name: 'Bare', identifiers: [], connections: [], locations: [], pinLinks: [], evidence: [] };
  const names = buildReportBundleFiles(bare).map((f) => f.name);
  assert.ok(!names.includes('saved-views.json'));
  assert.ok(!names.some((n) => n.startsWith('dossiers/')));
  assert.ok(names.includes('project.osint.json'));
});

test('project files and report bundles can both be read back as projects', async () => {
  const { parseProjectBytes, readProjectFromFile } = await import('../src/utils/projectIO.js');
  const enc = (text) => new TextEncoder().encode(text);

  const fromJson = parseProjectBytes(enc(JSON.stringify({ name: 'Plain file' })));
  assert.equal(fromJson.name, 'Plain file');

  const fromBundle = parseProjectBytes(buildReportBundleZip(project));
  assert.equal(fromBundle.name, 'Bundle <case>');
  assert.equal(fromBundle.identifiers.length, 2);
  assert.equal(fromBundle.filterPresets[0].name, 'Family');

  assert.throws(() => parseProjectBytes(createZip([{ name: 'other.txt', content: 'hi' }])), /not a report bundle/);
  assert.throws(() => parseProjectBytes(enc('not json')), /not valid JSON/);
  assert.throws(() => parseProjectBytes(enc('[1,2]')), /valid JSON object|missing a "name"/);

  const asFile = new File([buildReportBundleZip(project)], 'x.zip', { type: 'application/zip' });
  assert.equal((await readProjectFromFile(asFile)).name, 'Bundle <case>');
});

test('bundle contents can be limited, with the README listing only what is included', () => {
  const names = (include) => buildReportBundleFiles(project, { include }).map((f) => f.name);
  assert.deepEqual(names(['html', 'evidenceCsv']), ['README.txt', 'case-report.html', 'evidence.csv']);
  assert.deepEqual(names(['dossiers']), ['README.txt', 'dossiers/01-jane_doe_name.md']);

  const readme = buildReportBundleFiles(project, { include: ['markdown', 'views'] })[0].content;
  assert.match(readme, /case-report\.md/);
  assert.match(readme, /saved-views\.json/);
  assert.doesNotMatch(readme, /identifiers\.csv|case-report\.html|project\.osint\.json/);

  const bare = { name: 'Bare', identifiers: [], connections: [], locations: [], pinLinks: [], evidence: [] };
  assert.throws(() => buildReportBundleFiles(bare, { include: ['dossiers', 'views'] }), /at least one/);
  assert.throws(() => buildReportBundleFiles(project, { include: [] }), /at least one/);
});

test('reports which optional bundle parts have content', async () => {
  const { availableBundleSections } = await import('../src/utils/bundle.js');
  assert.deepEqual(availableBundleSections(project), { dossiers: 1, views: 1 });
  assert.deepEqual(
    availableBundleSections({ name: 'Bare', identifiers: [], connections: [], locations: [], pinLinks: [], evidence: [] }),
    { dossiers: 0, views: 0 },
  );
});
