import { IDENTIFIER_TYPES, getPrimaryFieldKey } from '../identifierTypes.js';
import { findDuplicateIdentifiers } from './duplicates.js';
import { normalizeColor, normalizeTags } from './identifierLabels.js';

// Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF, BOM.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text ?? '').replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Undo the apostrophe that exportCsv adds in front of formula-looking text.
const unguard = (value) => value.replace(/^'(?=[=+\-@\t\r])/, '');

const TYPE_ALIASES = { x: 'twitter', 'x / twitter': 'twitter', 'social media': 'custom' };

function resolveType(raw) {
  const wanted = raw.trim().toLowerCase();
  if (!wanted) return null;
  if (TYPE_ALIASES[wanted]) return TYPE_ALIASES[wanted];
  for (const [key, def] of Object.entries(IDENTIFIER_TYPES)) {
    if (key.toLowerCase() === wanted || def.label.toLowerCase() === wanted) return key;
  }
  return null;
}

function parseDetails(details, def) {
  const labels = def.fields.map((f) => f.label);
  const escaped = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const marker = new RegExp(`(?:^|; )(${escaped.join('|')}): `, 'g');
  const hits = [...details.matchAll(marker)];
  const fields = {};
  hits.forEach((hit, index) => {
    const start = hit.index + hit[0].length;
    const end = index + 1 < hits.length ? hits[index + 1].index : details.length;
    const field = def.fields.find((f) => f.label === hit[1]);
    if (field) fields[field.key] = details.slice(start, end).trim();
  });
  return fields;
}

const HEADER_ALIASES = {
  type: ['type', 'category', 'kind'],
  label: ['label', 'value', 'name', 'identifier'],
  details: ['details', 'fields'],
  notes: ['notes', 'note', 'comments'],
  tags: ['tags', 'tag', 'labels'],
  color: ['colour', 'color'],
};

function columnIndexes(header) {
  const lower = header.map((h) => h.trim().toLowerCase());
  const find = (names) => lower.findIndex((h) => names.includes(h));
  return Object.fromEntries(Object.entries(HEADER_ALIASES).map(([k, names]) => [k, find(names)]));
}

/**
 * Turn CSV text into identifier records (Type, Label/Value, Details, Notes).
 * Accepts files produced by the identifiers CSV export as well as simple
 * hand-made sheets. Rows that cannot be used come back in `skipped`.
 */
export function identifiersFromCsv(text, existing = []) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { records: [], skipped: [], error: 'The file has no data rows.' };

  const cols = columnIndexes(rows[0]);
  if (cols.type === -1 && cols.label === -1) {
    return { records: [], skipped: [], error: 'Could not find a "Type" or "Label" column.' };
  }

  const records = [];
  const skipped = [];
  const cell = (row, index) => (index === -1 ? '' : unguard((row[index] ?? '').trim()));

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const rawType = cell(row, cols.type);
    const label = cell(row, cols.label);
    const details = cell(row, cols.details);
    const notes = cell(row, cols.notes);
    const tags = normalizeTags(cell(row, cols.tags));
    const color = normalizeColor(cell(row, cols.color).toLowerCase());

    let typeKey = resolveType(rawType);
    if (!typeKey) typeKey = rawType || label ? 'custom' : null;
    if (!typeKey) {
      skipped.push({ line, reason: 'empty row' });
      return;
    }

    const def = IDENTIFIER_TYPES[typeKey];
    const fields = details ? parseDetails(details, def) : {};
    const primaryKey = getPrimaryFieldKey(typeKey);
    const typeLabelOnly = label.toLowerCase() === def.label.toLowerCase();
    if (!fields[primaryKey] && label && !typeLabelOnly) {
      fields[primaryKey] = label.replace(/\s+\([^)]*\)$/, '');
    }
    if (typeKey === 'custom' && !fields[primaryKey] && rawType) fields[primaryKey] = rawType;

    if (!fields[primaryKey]) {
      skipped.push({ line, reason: 'missing value' });
      return;
    }

    const record = { type: typeKey, fields, notes, tags, color };
    const duplicate = findDuplicateIdentifiers([...existing, ...records], record);
    if (duplicate.length > 0) {
      skipped.push({ line, reason: 'duplicate' });
      return;
    }
    records.push({ ...record, id: crypto.randomUUID() });
  });

  return { records, skipped, error: null };
}
