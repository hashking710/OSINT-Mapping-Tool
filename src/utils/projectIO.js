import { PROJECT_SCHEMA_VERSION } from './createProject.js';
import { readZipEntries } from './zip.js';

export function downloadProject(project) {
  const stamped = { ...project, updatedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(stamped, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (stamped.name || 'project')
    .replace(/[^a-z0-9-_]+/gi, '_')
    .toLowerCase();
  a.href = url;
  a.download = `${safeName}.osint.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return stamped;
}

export const BUNDLE_PROJECT_ENTRY = 'project.osint.json';

const isZip = (bytes) =>
  bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

// Accepts either a saved project file or a report bundle (.zip) and returns
// the validated project inside it.
export function parseProjectBytes(bytes) {
  let payload = bytes;
  if (isZip(bytes)) {
    let entry;
    try {
      entry = readZipEntries(bytes).find((e) => e.name === BUNDLE_PROJECT_ENTRY);
    } catch (err) {
      throw new Error(`Could not read that zip file (${err.message})`);
    }
    if (!entry) {
      throw new Error(`This zip is not a report bundle from this app (no ${BUNDLE_PROJECT_ENTRY} inside).`);
    }
    payload = entry.data;
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    throw new Error('File is not valid JSON.');
  }
  return validateProject(parsed);
}

export async function readProjectFromFile(file) {
  return parseProjectBytes(new Uint8Array(await file.arrayBuffer()));
}

export function validateProject(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Project file is not a valid JSON object.');
  }
  if (typeof obj.name !== 'string') {
    throw new Error('Project file is missing a "name".');
  }
  const schemaVersion = obj.schemaVersion ?? PROJECT_SCHEMA_VERSION;
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new Error('Project file has an invalid schema version.');
  }
  if (schemaVersion > PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Project file uses unsupported schema version ${schemaVersion}.`,
    );
  }
  const identifiers = Array.isArray(obj.identifiers) ? obj.identifiers : [];
  const locations = Array.isArray(obj.locations) ? obj.locations : [];
  const connections = Array.isArray(obj.connections) ? obj.connections : [];
  const pinLinks = Array.isArray(obj.pinLinks) ? obj.pinLinks : [];
  const evidence = Array.isArray(obj.evidence) ? obj.evidence : [];
  const mergeLog = (Array.isArray(obj.mergeLog) ? obj.mergeLog : [])
    .filter((e) => e && typeof e.id === 'string' && typeof e.at === 'string' && typeof e.text === 'string')
    .map((e) => ({
      id: e.id,
      at: e.at,
      source: typeof e.source === 'string' ? e.source.slice(0, 120) : '',
      text: e.text.slice(0, 300),
      total: Number.isFinite(e.total) ? e.total : 0,
    }))
    .slice(-50);
  const filterPresets = (Array.isArray(obj.filterPresets) ? obj.filterPresets : [])
    .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim())
    .map((p) => ({
      id: p.id,
      name: p.name.trim().slice(0, 40),
      query: typeof p.query === 'string' ? p.query : '',
      tag: typeof p.tag === 'string' && p.tag ? p.tag : null,
      color: typeof p.color === 'string' && p.color ? p.color : null,
    }));
  const identifierIds = new Set(identifiers.map((identifier) => identifier?.id));
  const locationIds = new Set(locations.map((location) => location?.id));

  if (
    identifiers.some(
      (identifier) =>
        !identifier || typeof identifier !== 'object' || typeof identifier.id !== 'string',
    )
  ) {
    throw new Error('Project file contains an identifier with an invalid id.');
  }
  if (identifierIds.size !== identifiers.length) {
    throw new Error('Project file contains duplicate identifier ids.');
  }
  if (
    locations.some(
      (location) =>
        !location ||
        typeof location !== 'object' ||
        typeof location.id !== 'string' ||
        !Number.isFinite(location.lat) ||
        !Number.isFinite(location.lng),
    )
  ) {
    throw new Error('Project file contains a location with invalid coordinates.');
  }
  if (locationIds.size !== locations.length) {
    throw new Error('Project file contains duplicate location ids.');
  }
  if (
    connections.some(
      (connection) =>
        !connection ||
        typeof connection !== 'object' ||
        typeof connection.id !== 'string' ||
        connection.source === connection.target ||
        !identifierIds.has(connection.source) ||
        !identifierIds.has(connection.target),
    )
  ) {
    throw new Error('Project file contains a connection with an invalid identifier reference.');
  }
  if (new Set(connections.map((connection) => connection?.id)).size !== connections.length) {
    throw new Error('Project file contains duplicate connection ids.');
  }
  if (
    pinLinks.some(
      (link) =>
        !link ||
        typeof link !== 'object' ||
        typeof link.id !== 'string' ||
        !locationIds.has(link.pinId) ||
        !identifierIds.has(link.identifierId),
    )
  ) {
    throw new Error('Project file contains a link with an invalid identifier or location reference.');
  }
  const pinLinkPairs = new Set(
    pinLinks.map((link) => `${link?.pinId}\u0000${link?.identifierId}`),
  );
  if (pinLinkPairs.size !== pinLinks.length) {
    throw new Error('Project file contains duplicate pin links.');
  }
  if (
    evidence.some(
      (entry) =>
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.id !== 'string' ||
        typeof entry.title !== 'string' ||
        typeof entry.text !== 'string' ||
        typeof entry.source !== 'string',
    )
  ) {
    throw new Error('Project file contains invalid evidence entries.');
  }

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: obj.id || crypto.randomUUID(),
    name: obj.name,
    createdAt: obj.createdAt || new Date().toISOString(),
    updatedAt: obj.updatedAt || new Date().toISOString(),
    target: {
      name: obj.target?.name ?? '',
      notes: obj.target?.notes ?? '',
    },
    identifiers,
    connections,
    locations,
    pinLinks,
    filterPresets,
    mergeLog,
    evidence: evidence.map((entry) => ({
      id: entry.id,
      title: entry.title,
      subtitle: entry.subtitle ?? '',
      text: entry.text,
      source: entry.source,
      sourceUrl: entry.sourceUrl ?? '',
      context: entry.context ?? '',
      createdAt: entry.createdAt || new Date().toISOString(),
    })),
    mapDisplay: {
      showPinConnections: !!obj.mapDisplay?.showPinConnections,
      pinConnectionColor:
        typeof obj.mapDisplay?.pinConnectionColor === 'string'
          ? obj.mapDisplay.pinConnectionColor
          : '#ef4444',
    },
  };
}
