// Identifier `type` values must exist in src/identifierTypes.js and `fields`
// keys must match that type's field keys, otherwise the node renders as a
// generic "Custom" identifier.
export const PROJECT_TEMPLATE_LIBRARY = {
  blank: {
    key: 'blank',
    name: 'Blank project',
    description: 'Start from an empty canvas.',
    targetName: '',
    notes: '',
    identifiers: [],
  },
  person: {
    key: 'person',
    name: 'Person investigation',
    description: 'Name, email, phone, address, and a social profile to fill in.',
    targetName: '',
    notes: 'Track identities, aliases, relationships, travel patterns, and known associates.',
    identifiers: [
      { type: 'name', fields: {}, notes: 'Primary subject' },
      { type: 'email', fields: {}, notes: '' },
      { type: 'phone', fields: {}, notes: '' },
      { type: 'address', fields: {}, notes: 'Last known address' },
      { type: 'instagram', fields: {}, notes: '' },
    ],
  },
  company: {
    key: 'company',
    name: 'Company investigation',
    description: 'Entity, director, registered office, and contact points.',
    targetName: '',
    notes: 'Map company relationships, office locations, and key people.',
    identifiers: [
      { type: 'custom', fields: { title: 'Company name' }, notes: 'Primary entity' },
      { type: 'name', fields: {}, notes: 'Director / decision maker' },
      { type: 'address', fields: {}, notes: 'Registered office' },
      { type: 'phone', fields: {}, notes: '' },
      { type: 'email', fields: {}, notes: '' },
    ],
  },
  vehicle: {
    key: 'vehicle',
    name: 'Vehicle / location',
    description: 'Site of interest with a vehicle and plate to track.',
    targetName: '',
    notes: 'Track sites of interest, movement routes, and associated vehicles.',
    identifiers: [
      { type: 'address', fields: {}, notes: 'Site of interest' },
      { type: 'vehicle', fields: {}, notes: 'Associated vehicle' },
      { type: 'licensePlate', fields: {}, notes: '' },
    ],
  },
};

export function getBuiltInProjectTemplates() {
  return Object.values(PROJECT_TEMPLATE_LIBRARY);
}

export function buildProjectTemplate(key) {
  const template = PROJECT_TEMPLATE_LIBRARY[key] ?? PROJECT_TEMPLATE_LIBRARY.blank;
  return {
    name: template.name,
    targetName: template.targetName,
    notes: template.notes,
    identifiers: template.identifiers.map((entry, index) => ({
      id: crypto.randomUUID(),
      type: entry.type,
      fields: { ...(entry.fields ?? {}) },
      notes: entry.notes ?? '',
      position: { x: 60 + (index % 4) * 240, y: 60 + Math.floor(index / 4) * 150 },
    })),
  };
}
