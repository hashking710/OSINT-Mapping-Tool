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
    ],
  );
  assert.ok(RAPID_API_PROVIDER_LIBRARY.peopleDataLabs);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.securityTrails);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.geoapify);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.numverify);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.shodan);
  assert.ok(RAPID_API_PROVIDER_LIBRARY.virusTotal);
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