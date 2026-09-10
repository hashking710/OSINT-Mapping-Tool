import { PROJECT_SCHEMA_VERSION } from './createProject.js';

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

export function buildCaseReport(project) {
  const safeProject = validateProject(project);
  const targetName = safeProject.target?.name || 'Unspecified target';
  const targetNotes = safeProject.target?.notes?.trim();
  const evidence = Array.isArray(safeProject.evidence) ? safeProject.evidence : [];

  const lines = [
    `Case report: ${safeProject.name}`,
    `Target: ${targetName}`,
    targetNotes ? `Target notes: ${targetNotes}` : '',
    '',
    `Identifiers: ${safeProject.identifiers.length}`,
    `Locations: ${safeProject.locations.length}`,
    `Evidence entries: ${evidence.length}`,
    '',
    'Evidence excerpts:',
  ];

  if (evidence.length === 0) {
    lines.push('No evidence entries captured yet.');
  } else {
    evidence.forEach((entry, index) => {
      lines.push(``);
      lines.push(`${index + 1}. ${entry.title}${entry.subtitle ? ` — ${entry.subtitle}` : ''}`);
      lines.push(entry.text);
      lines.push(`Source: ${entry.source}${entry.sourceUrl ? ` — ${entry.sourceUrl}` : ''}`);
    });
  }

  return lines.filter((line) => line !== '').join('\n');
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
