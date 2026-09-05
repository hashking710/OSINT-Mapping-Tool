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

export function validateProject(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Project file is not a valid JSON object.');
  }
  if (typeof obj.name !== 'string') {
    throw new Error('Project file is missing a "name".');
  }
  if (obj.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    // Soft accept for now; future migrations can branch here.
    console.warn(
      `Project schemaVersion ${obj.schemaVersion} differs from current ${PROJECT_SCHEMA_VERSION}.`,
    );
  }
  const identifiers = Array.isArray(obj.identifiers) ? obj.identifiers : [];
  const locations = Array.isArray(obj.locations) ? obj.locations : [];
  const connections = Array.isArray(obj.connections) ? obj.connections : [];
  const pinLinks = Array.isArray(obj.pinLinks) ? obj.pinLinks : [];
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
  if (
    locations.some(
      (location) =>
        !location || typeof location !== 'object' || typeof location.id !== 'string',
    )
  ) {
    throw new Error('Project file contains a location with an invalid id.');
  }
  if (
    connections.some(
      (connection) =>
        !connection ||
        typeof connection !== 'object' ||
        typeof connection.id !== 'string' ||
        !identifierIds.has(connection.source) ||
        !identifierIds.has(connection.target),
    )
  ) {
    throw new Error('Project file contains a connection with an invalid identifier reference.');
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
    mapDisplay: {
      showPinConnections: !!obj.mapDisplay?.showPinConnections,
      pinConnectionColor:
        typeof obj.mapDisplay?.pinConnectionColor === 'string'
          ? obj.mapDisplay.pinConnectionColor
          : '#ef4444',
    },
  };
}
