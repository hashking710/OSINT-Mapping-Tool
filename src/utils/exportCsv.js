import { describeIdentifier } from './caseReport.js';
import { validateProject } from './projectIO.js';
import { getTypeDef } from '../identifierTypes.js';
import { normalizeColor, normalizeTags } from './identifierLabels.js';

const FORMULA_START = /^[=+\-@\t\r]/;

// Prefixing risky strings with an apostrophe stops spreadsheets executing
// cell contents as formulas. Numbers are written as-is.
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value !== 'number' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function buildIdentifiersCsv(project) {
  const { identifiers, connections, locations, pinLinks } = validateProject(project);
  const byId = new Map(identifiers.map((i) => [i.id, i]));
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const rows = identifiers.map((identifier) => {
    const def = getTypeDef(identifier.type);
    const details = def.fields
      .map((f) => [f.label, identifier.fields?.[f.key]])
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(([label, v]) => `${label}: ${String(v).trim()}`)
      .join('; ');
    const connected = connections
      .filter((c) => c.source === identifier.id || c.target === identifier.id)
      .map((c) => {
        const other = byId.get(c.source === identifier.id ? c.target : c.source);
        if (!other) return null;
        return c.label ? `${describeIdentifier(other)} [${c.label}]` : describeIdentifier(other);
      })
      .filter(Boolean)
      .join('; ');
    const pins = pinLinks
      .filter((l) => l.identifierId === identifier.id)
      .map((l) => locationById.get(l.pinId)?.label || 'Unnamed pin')
      .join('; ');
    return [
      def.label,
      describeIdentifier(identifier),
      details,
      identifier.notes ?? '',
      normalizeTags(identifier.tags).join('; '),
      normalizeColor(identifier.color) ?? '',
      connected,
      pins,
      identifier.createdAt ?? '',
    ];
  });

  return toCsv(
    ['Type', 'Label', 'Details', 'Notes', 'Tags', 'Colour', 'Connected to', 'Linked locations', 'Created'],
    rows,
  );
}

export function buildLocationsCsv(project) {
  const { identifiers, locations, pinLinks } = validateProject(project);
  const byId = new Map(identifiers.map((i) => [i.id, i]));
  const rows = locations.map((location) => {
    const linked = pinLinks
      .filter((l) => l.pinId === location.id)
      .map((l) => byId.get(l.identifierId))
      .filter(Boolean)
      .map(describeIdentifier)
      .join('; ');
    return [
      location.label ?? '',
      location.address ?? '',
      location.lat,
      location.lng,
      location.visitedAt ?? '',
      location.withWho ?? '',
      location.notes ?? '',
      linked,
    ];
  });
  return toCsv(
    ['Label', 'Address', 'Latitude', 'Longitude', 'Visited', 'With', 'Notes', 'Linked identifiers'],
    rows,
  );
}

export function buildEvidenceCsv(project) {
  const { evidence } = validateProject(project);
  const rows = evidence
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((e) => [e.createdAt.slice(0, 10), e.title, e.subtitle, e.text, e.source, e.sourceUrl]);
  return toCsv(['Date', 'Title', 'Subtitle', 'Text', 'Source', 'Source URL'], rows);
}
