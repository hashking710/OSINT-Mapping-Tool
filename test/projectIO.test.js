import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppConfig } from '../src/utils/appConfig.js';
import {
  getEnabledRapidApiProviders,
  RAPID_API_PROVIDER_ORDER,
  RAPID_API_PROVIDER_LIBRARY,
  summarizeExternalApiResult,
} from '../src/utils/externalApis.js';
import { buildCaseReport, validateProject } from '../src/utils/projectIO.js';
import { buildProjectTemplate, getBuiltInProjectTemplates } from '../src/utils/projectTemplates.js';
import { filterPinsForQuery } from '../src/utils/pinSearch.js';
import { IDENTIFIER_TYPES } from '../src/identifierTypes.js';

const validProject = {
  schemaVersion: 1,
  id: 'project-1',
  name: 'Case 1',
  identifiers: [{ id: 'identifier-1', type: 'custom', fields: {} }],
  connections: [],
  locations: [],
  pinLinks: [],
};

test('validates and normalizes a project file', () => {
  const project = validateProject(validProject);

  assert.equal(project.schemaVersion, 1);
  assert.equal(project.name, 'Case 1');
  assert.deepEqual(project.target, { name: '', notes: '' });
  assert.deepEqual(project.mapDisplay, {
    showPinConnections: false,
    pinConnectionColor: '#ef4444',
  });
});

test('accepts files without a schema version as the initial schema', () => {
  const { schemaVersion } = validateProject({ ...validProject, schemaVersion: undefined });

  assert.equal(schemaVersion, 1);
});

test('rejects files from a newer unsupported schema', () => {
  assert.throws(
    () => validateProject({ ...validProject, schemaVersion: 2 }),
    /unsupported schema version/i,
  );
});

test('rejects connections that reference missing identifiers', () => {
  assert.throws(
    () =>
      validateProject({
        ...validProject,
        connections: [
          { id: 'connection-1', source: 'identifier-1', target: 'missing' },
        ],
      }),
    /connection.*identifier/i,
  );
});

test('rejects pin links that reference missing pins or identifiers', () => {
  assert.throws(
    () =>
      validateProject({
        ...validProject,
        locations: [{ id: 'location-1', lat: 0, lng: 0 }],
        pinLinks: [
          {
            id: 'link-1',
            pinId: 'location-1',
            identifierId: 'missing',
          },
        ],
      }),
    /link.*reference/i,
  );
});

test('rejects duplicate identifier ids', () => {
  assert.throws(
    () =>
      validateProject({
        ...validProject,
        identifiers: [
          { id: 'identifier-1', type: 'custom', fields: {} },
          { id: 'identifier-1', type: 'custom', fields: {} },
        ],
      }),
    /duplicate identifier ids/i,
  );
});

test('rejects self-connections', () => {
  assert.throws(
    () =>
      validateProject({
        ...validProject,
        connections: [
          { id: 'connection-1', source: 'identifier-1', target: 'identifier-1' },
        ],
      }),
    /connection.*identifier/i,
  );
});

test('rejects locations without finite coordinates', () => {
  assert.throws(
    () =>
      validateProject({
        ...validProject,
        locations: [{ id: 'location-1', lat: 'unknown', lng: 0 }],
      }),
    /location.*coordinates/i,
  );
});

test('exposes the full recommended OSINT provider registry', () => {
  assert.deepEqual(
    RAPID_API_PROVIDER_ORDER,
    [
      'peopleDataLabs',
      'clearbit',
      'securityTrails',
      'ipApi',
      'abuseIpDb',
      'geoapify',
      'hunter',
      'numverify',
      'shodan',
      'virusTotal',
      'socialLookup',
      'openAlex',
      'wikidata',
      'wikipedia',
      'openCorporates',
      'threatFox',
    ],
  );
  assert.ok(RAPID_API_PROVIDER_LIBRARY.peopleDataLabs);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.securityTrails);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.geoapify);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.numverify);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.shodan);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.virusTotal);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.wikidata);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.wikipedia);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.openCorporates);
});

test('summarizes provider payloads into useful evidence cards', () => {
  const people = summarizeExternalApiResult('peopleDataLabs', {
    full_name: 'Ava Stone',
    company: 'Northwind Labs',
    location: 'Seattle, WA',
    email: 'ava@example.com',
    summary: 'Professional identity match',
  });
  assert.equal(people.title, 'Ava Stone');
  assert.match(people.text, /Northwind Labs|Seattle/);

  const geo = summarizeExternalApiResult('geoapify', {
    features: [{
      properties: {
        formatted: '123 Main St, Seattle, WA',
        city: 'Seattle',
        country: 'United States',
      },
    }],
  });
  assert.equal(geo.title, '123 Main St, Seattle, WA');
  assert.match(geo.text, /Seattle|United States/);

  const security = summarizeExternalApiResult('securityTrails', {
    domain: 'example.com',
    subdomains: ['api.example.com', 'www.example.com'],
    whois: { registrar: 'Example Registrar' },
  });
  assert.equal(security.title, 'example.com');
  assert.match(security.text, /api.example.com|Example Registrar/);
});

test('creates a starter project template with a name, notes, and identifiers', () => {
  const template = buildProjectTemplate('person');
  assert.equal(template.name, 'Person investigation');
  assert.ok(template.notes.length > 0);
  assert.ok(template.identifiers.length > 0);
});

test('unknown template keys fall back to an empty blank project', () => {
  const template = buildProjectTemplate('does-not-exist');
  assert.equal(template.name, 'Blank project');
  assert.deepEqual(template.identifiers, []);
});

test('every built-in template uses real identifier types and field keys', () => {
  const templates = getBuiltInProjectTemplates();
  assert.ok(templates.some((template) => template.key === 'blank'));
  assert.ok(templates.some((template) => template.key === 'person'));
  assert.ok(templates.some((template) => template.key === 'company'));

  for (const { key } of templates) {
    for (const identifier of buildProjectTemplate(key).identifiers) {
      const def = IDENTIFIER_TYPES[identifier.type];
      assert.ok(def, `${key}: unknown identifier type "${identifier.type}"`);
      const fieldKeys = def.fields.map((field) => field.key);
      for (const fieldKey of Object.keys(identifier.fields)) {
        assert.ok(fieldKeys.includes(fieldKey), `${key}/${identifier.type}: unknown field "${fieldKey}"`);
      }
    }
  }
});

test('filters pins by matching labels, addresses, and notes with a query', () => {
  const pins = [
    { id: 'a', label: 'Dublin Warehouse', address: 'Lower Baggot Street', notes: 'Meetup site' },
    { id: 'b', label: 'Port Office', address: 'Cork Quay', notes: 'Primary office' },
    { id: 'c', label: 'Vehicle', address: 'Unknown', notes: 'No link' },
  ];

  assert.deepEqual(filterPinsForQuery(pins, 'dublin'), [pins[0]]);
  assert.deepEqual(filterPinsForQuery(pins, 'office'), [pins[1]]);
  assert.deepEqual(filterPinsForQuery(pins, ''), pins);
  assert.deepEqual(filterPinsForQuery(pins, 'unknown link'), [pins[2]]);
});

test('builds a case report with a simple timeline section for evidence entries', () => {
  const report = buildCaseReport({
    name: 'Example case',
    target: { name: 'Jane Doe', notes: 'Primary subject' },
    identifiers: [],
    locations: [],
    evidence: [
      {
        id: 'e-1',
        title: 'Contact found',
        subtitle: 'Email match',
        text: 'Recovered an email address linked to the target.',
        source: 'Public lookup',
        sourceUrl: 'https://example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'e-2',
        title: 'Meeting place',
        text: 'Warehouse linked by local reporting.',
        source: 'Open source',
        createdAt: '2024-01-02T00:00:00.000Z',
      },
    ],
  });

  assert.match(report, /Timeline of evidence/i);
  assert.match(report, /Contact found/i);
  assert.match(report, /Meeting place/i);
});

test('case report lists identifiers, connections, locations, and links', () => {
  const report = buildCaseReport({
    name: 'Full case',
    target: { name: 'Jane Doe', notes: '' },
    identifiers: [
      { id: 'i1', type: 'name', fields: { fullName: 'Jane Doe' }, notes: 'Subject' },
      { id: 'i2', type: 'email', fields: { address: 'jane@example.com' } },
    ],
    connections: [{ id: 'c1', source: 'i1', target: 'i2' }],
    locations: [
      { id: 'l1', lat: 53.3498, lng: -6.2603, label: 'Dublin office', address: 'Baggot St', withWho: 'Bob' },
    ],
    pinLinks: [{ id: 'p1', pinId: 'l1', identifierId: 'i1', context: 'works here' }],
    evidence: [],
  });

  assert.match(report, /## Identifiers/);
  assert.match(report, /Jane Doe \(Name\)/);
  assert.match(report, /Email address: jane@example\.com/);
  assert.match(report, /Connected to: jane@example\.com \(Email\)/);
  assert.match(report, /Linked locations: Dublin office/);
  assert.match(report, /Dublin office \(53\.34980, -6\.26030\)/);
  assert.match(report, /With: Bob/);
  assert.match(report, /Jane Doe \(Name\) \(works here\)/);
  assert.match(report, /No evidence entries captured yet/);
});
