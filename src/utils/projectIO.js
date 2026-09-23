import { PROJECT_SCHEMA_VERSION } from './createProject.js';
import { getDisplayLabel, getTypeDef } from '../identifierTypes.js';

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

export function readProjectFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const validated = validateProject(parsed);
        resolve(validated);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

const shortDate = (iso) => (typeof iso === 'string' && iso ? iso.slice(0, 10) : '');

function describeIdentifier(identifier) {
  const def = getTypeDef(identifier.type);
  const label = getDisplayLabel(identifier);
  return label === def.label ? def.label : `${label} (${def.label})`;
}

export function buildCaseReport(project) {
  const safe = validateProject(project);
  const { identifiers, connections, locations, pinLinks } = safe;
  const evidence = safe.evidence
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const identifierById = new Map(identifiers.map((i) => [i.id, i]));
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const lines = [
    `# Case report: ${safe.name}`,
    '',
    `Target: ${safe.target.name || 'Unspecified target'}`,
  ];
  if (safe.target.notes.trim()) lines.push(`Target notes: ${safe.target.notes.trim()}`);
  lines.push(
    `Created: ${shortDate(safe.createdAt)}  |  Last updated: ${shortDate(safe.updatedAt)}`,
    `Summary: ${identifiers.length} identifiers, ${connections.length} connections, ` +
      `${locations.length} locations, ${evidence.length} evidence entries`,
    '',
    '## Identifiers',
  );

  if (identifiers.length === 0) lines.push('None recorded.');
  identifiers.forEach((identifier, index) => {
    const def = getTypeDef(identifier.type);
    lines.push('', `${index + 1}. ${describeIdentifier(identifier)}`);
    for (const field of def.fields) {
      const value = identifier.fields?.[field.key];
      if (value === undefined || value === null || String(value).trim() === '') continue;
      lines.push(`   - ${field.label}: ${String(value).trim()}`);
    }
    if (identifier.notes?.trim()) lines.push(`   - Notes: ${identifier.notes.trim()}`);

    const related = connections
      .filter((c) => c.source === identifier.id || c.target === identifier.id)
      .map((c) => identifierById.get(c.source === identifier.id ? c.target : c.source))
      .filter(Boolean)
      .map(describeIdentifier);
    if (related.length) lines.push(`   - Connected to: ${related.join('; ')}`);

    const pins = pinLinks
      .filter((l) => l.identifierId === identifier.id)
      .map((l) => locationById.get(l.pinId)?.label || 'Unnamed pin');
    if (pins.length) lines.push(`   - Linked locations: ${pins.join('; ')}`);
  });

  lines.push('', '## Locations');
  if (locations.length === 0) lines.push('None recorded.');
  locations.forEach((location, index) => {
    lines.push(
      '',
      `${index + 1}. ${location.label || 'Unnamed pin'} (${location.lat.toFixed(5)}, ${location.lng.toFixed(5)})`,
    );
    if (location.address) lines.push(`   - Address: ${location.address}`);
    if (location.visitedAt) lines.push(`   - Visited: ${location.visitedAt}`);
    if (location.withWho) lines.push(`   - With: ${location.withWho}`);
    if (location.notes?.trim()) lines.push(`   - Notes: ${location.notes.trim()}`);
    const linked = pinLinks
      .filter((l) => l.pinId === location.id)
      .map((l) => {
        const who = identifierById.get(l.identifierId);
        if (!who) return null;
        return l.context ? `${describeIdentifier(who)} (${l.context})` : describeIdentifier(who);
      })
      .filter(Boolean);
    if (linked.length) lines.push(`   - Linked identifiers: ${linked.join('; ')}`);
  });

  lines.push('', '## Timeline of evidence');
  if (evidence.length === 0) lines.push('No evidence entries captured yet.');
  evidence.forEach((entry, index) => {
    const heading = `${index + 1}. ${shortDate(entry.createdAt)} - ${entry.title}`;
    lines.push('', entry.subtitle ? `${heading} - ${entry.subtitle}` : heading);
    lines.push(`   ${entry.text}`);
    lines.push(`   Source: ${entry.source}${entry.sourceUrl ? ` (${entry.sourceUrl})` : ''}`);
  });

  return `${lines.join('\n')}\n`;
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
