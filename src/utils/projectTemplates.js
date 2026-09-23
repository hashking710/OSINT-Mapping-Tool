export const PROJECT_TEMPLATE_LIBRARY = {
  person: {
    key: 'person',
    name: 'Person investigation',
    targetName: 'person: unknown subject',
    notes: 'Track person identities, aliases, relationships, travel patterns, and known associates.',
    identifiers: [
      { type: 'person', fields: { fullName: 'Subject', aliases: '', phone: '', email: '' }, notes: 'Primary subject' },
      { type: 'email', fields: { value: 'target@example.com' }, notes: 'Known contact' },
    ],
  },
  company: {
    key: 'company',
    name: 'Company investigation',
    targetName: 'company: unknown entity',
    notes: 'Map company relationships, office locations, and operational lead indicators.',
    identifiers: [
      { type: 'company', fields: { name: 'Target company' }, notes: 'Primary entity' },
      { type: 'person', fields: { fullName: 'Director' }, notes: 'Decision maker' },
    ],
  },
  location: {
    key: 'location',
    name: 'Location investigation',
    targetName: 'location: unknown region',
    notes: 'Track location sites of interest, movement routes, and associated associates.',
    identifiers: [
      { type: 'location', fields: { place: 'Target site' }, notes: 'Primary location' },
      { type: 'vehicle', fields: { plate: 'Unknown' }, notes: 'Possible travel pattern' },
    ],
  },
};

export function getBuiltInProjectTemplates() {
  return Object.values(PROJECT_TEMPLATE_LIBRARY);
}

export function buildProjectTemplate(key) {
  const template = PROJECT_TEMPLATE_LIBRARY[key] ?? PROJECT_TEMPLATE_LIBRARY.person;
  return {
    name: template.name,
    targetName: template.targetName,
    notes: template.notes,
    identifiers: template.identifiers.map((entry, index) => ({
      ...entry,
      id: crypto.randomUUID(),
      type: entry.type,
      fields: { ...(entry.fields ?? {}) },
      notes: entry.notes ?? '',
      position: { x: 60 + (index % 4) * 240, y: 60 + Math.floor(index / 4) * 150 },
    })),
  };
}
