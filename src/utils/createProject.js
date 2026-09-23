import { normalizeColor, normalizeTags } from './identifierLabels.js';

export const PROJECT_SCHEMA_VERSION = 1;

export function createProject({ name, targetName = '', notes = '', identifiers = [] }) {
  const now = new Date().toISOString();
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled Project',
    createdAt: now,
    updatedAt: now,
    target: {
      name: targetName.trim(),
      notes: notes.trim(),
    },
    identifiers: identifiers.map((identifier, idx) => ({
      id: identifier.id ?? crypto.randomUUID(),
      type: identifier.type,
      fields: identifier.fields ?? {},
      notes: identifier.notes ?? '',
      position: identifier.position ?? { x: 60 + (idx % 4) * 240, y: 60 + Math.floor(idx / 4) * 150 },
      customIconId: identifier.customIconId ?? null,
      color: normalizeColor(identifier.color),
      tags: normalizeTags(identifier.tags),
      createdAt: now,
      updatedAt: now,
    })),
    connections: [],
    filterPresets: [],
    mergeLog: [],
    locations: [],
    pinLinks: [],
    evidence: [],
    mapDisplay: {
      showPinConnections: false,
      pinConnectionColor: '#ef4444',
    },
  };
}
