import { getTypeDef } from '../identifierTypes.js';
import { describeIdentifier } from './caseReport.js';
import { findDuplicateIdentifiers } from './duplicates.js';
import { normalizeColor, normalizeTags } from './identifierLabels.js';
import { validateProject } from './projectIO.js';

const clean = (value) => String(value ?? '').trim();
const norm = (value) => clean(value).toLowerCase().replace(/\s+/g, ' ');
const show = (value) => (clean(value) === '' ? '(empty)' : `"${clean(value)}"`);
const shortDate = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

// Pair identifiers that are "the same" in both projects: by id first, then by a
// shared identity value (email, phone, or the primary field within a type).
function matchIdentifiers(before, after) {
  const pairs = [];
  const usedBefore = new Set();
  const usedAfter = new Set();
  const beforeById = new Map(before.map((i) => [i.id, i]));

  for (const b of after) {
    const a = beforeById.get(b.id);
    if (a) {
      pairs.push({ a, b });
      usedBefore.add(a.id);
      usedAfter.add(b.id);
    }
  }
  for (const b of after) {
    if (usedAfter.has(b.id)) continue;
    const pool = before.filter((a) => !usedBefore.has(a.id));
    const hit = findDuplicateIdentifiers(pool, b)[0];
    if (hit) {
      pairs.push({ a: hit.identifier, b });
      usedBefore.add(hit.identifier.id);
      usedAfter.add(b.id);
    }
  }
  return {
    pairs,
    removed: before.filter((a) => !usedBefore.has(a.id)),
    added: after.filter((b) => !usedAfter.has(b.id)),
  };
}

function describeIdentifierChanges(a, b) {
  const changes = [];
  if (a.type !== b.type) {
    changes.push(`Type: ${getTypeDef(a.type).label} \u2192 ${getTypeDef(b.type).label}`);
  }
  const def = getTypeDef(b.type);
  const labelFor = (key) => def.fields.find((f) => f.key === key)?.label ?? getTypeDef(a.type).fields.find((f) => f.key === key)?.label ?? key;
  const keys = new Set([...Object.keys(a.fields ?? {}), ...Object.keys(b.fields ?? {})]);
  for (const key of keys) {
    const before = clean(a.fields?.[key]);
    const after = clean(b.fields?.[key]);
    if (before !== after) changes.push(`${labelFor(key)}: ${show(before)} \u2192 ${show(after)}`);
  }
  if (clean(a.notes) !== clean(b.notes)) changes.push('Notes changed');

  const tagsBefore = normalizeTags(a.tags);
  const tagsAfter = normalizeTags(b.tags);
  const lower = (list) => new Set(list.map((t) => t.toLowerCase()));
  const added = tagsAfter.filter((t) => !lower(tagsBefore).has(t.toLowerCase()));
  const removed = tagsBefore.filter((t) => !lower(tagsAfter).has(t.toLowerCase()));
  if (added.length || removed.length) {
    changes.push(`Tags: ${[...added.map((t) => `+${t}`), ...removed.map((t) => `\u2212${t}`)].join(' ')}`);
  }
  const colorBefore = normalizeColor(a.color);
  const colorAfter = normalizeColor(b.color);
  if (colorBefore !== colorAfter) {
    changes.push(`Colour label: ${colorBefore ?? 'none'} \u2192 ${colorAfter ?? 'none'}`);
  }
  return changes;
}

const locationKey = (l) => `${l.lat.toFixed(4)},${l.lng.toFixed(4)}|${norm(l.label)}`;

function matchLocations(before, after) {
  const pairs = [];
  const usedBefore = new Set();
  const usedAfter = new Set();
  const beforeById = new Map(before.map((l) => [l.id, l]));
  for (const b of after) {
    const a = beforeById.get(b.id);
    if (a) {
      pairs.push({ a, b });
      usedBefore.add(a.id);
      usedAfter.add(b.id);
    }
  }
  const beforeByKey = new Map(before.filter((l) => !usedBefore.has(l.id)).map((l) => [locationKey(l), l]));
  for (const b of after) {
    if (usedAfter.has(b.id)) continue;
    const a = beforeByKey.get(locationKey(b));
    if (a && !usedBefore.has(a.id)) {
      pairs.push({ a, b });
      usedBefore.add(a.id);
      usedAfter.add(b.id);
    }
  }
  return {
    pairs,
    removed: before.filter((a) => !usedBefore.has(a.id)),
    added: after.filter((b) => !usedAfter.has(b.id)),
  };
}

function describeLocationChanges(a, b) {
  const changes = [];
  if (Math.abs(a.lat - b.lat) > 1e-5 || Math.abs(a.lng - b.lng) > 1e-5) {
    changes.push(`Moved: (${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}) \u2192 (${b.lat.toFixed(5)}, ${b.lng.toFixed(5)})`);
  }
  for (const [key, label] of [
    ['label', 'Label'],
    ['address', 'Address'],
    ['visitedAt', 'Visited'],
    ['withWho', 'With'],
    ['notes', 'Notes'],
    ['color', 'Pin colour'],
  ]) {
    if (clean(a[key]) !== clean(b[key])) {
      changes.push(key === 'notes' ? 'Notes changed' : `${label}: ${show(a[key])} \u2192 ${show(b[key])}`);
    }
  }
  return changes;
}

const evidenceKey = (e) => `${norm(e.title)}|${norm(e.source)}|${norm(e.text)}`;

function diffEvidence(before, after) {
  const beforeIds = new Set(before.map((e) => e.id));
  const afterIds = new Set(after.map((e) => e.id));
  const beforeKeys = new Set(before.map(evidenceKey));
  const afterKeys = new Set(after.map(evidenceKey));
  const view = (e) => ({ date: shortDate(e.createdAt), title: e.title, source: e.source });
  return {
    added: after.filter((e) => !beforeIds.has(e.id) && !beforeKeys.has(evidenceKey(e))).map(view),
    removed: before.filter((e) => !afterIds.has(e.id) && !afterKeys.has(evidenceKey(e))).map(view),
  };
}

export function diffProjects(projectBefore, projectAfter) {
  const a = validateProject(projectBefore);
  const b = validateProject(projectAfter);

  const ids = matchIdentifiers(a.identifiers, b.identifiers);
  const changedIdentifiers = [];
  let unchangedIdentifiers = 0;
  for (const { a: from, b: to } of ids.pairs) {
    const changes = describeIdentifierChanges(from, to);
    if (changes.length) changedIdentifiers.push({ title: describeIdentifier(to), changes });
    else unchangedIdentifiers += 1;
  }

  // Canonical identifier ids so links can be compared across both projects.
  const canon = new Map();
  for (const { a: from, b: to } of ids.pairs) canon.set(`a:${from.id}`, to.id);
  const canonA = (id) => canon.get(`a:${id}`) ?? `a:${id}`;
  const aById = new Map(a.identifiers.map((i) => [i.id, i]));
  const bById = new Map(b.identifiers.map((i) => [i.id, i]));
  const nameOf = (canonicalId) => {
    const identifier = bById.get(canonicalId) ?? aById.get(canonicalId.replace(/^a:/, ''));
    return identifier ? describeIdentifier(identifier) : 'Unknown identifier';
  };

  const connectionMap = (project, mapId) =>
    new Map(
      project.connections.map((c) => [[mapId(c.source), mapId(c.target)].sort().join('|'), c]),
    );
  const connA = connectionMap(a, canonA);
  const connB = connectionMap(b, (id) => id);
  const describeConnection = (key, label) => {
    const [x, y] = key.split('|');
    return `${nameOf(x)} \u2014 ${nameOf(y)}${label ? ` [${label}]` : ''}`;
  };
  const connections = { added: [], removed: [], changed: [] };
  for (const [key, c] of connB) {
    if (!connA.has(key)) connections.added.push(describeConnection(key, c.label));
    else if (clean(connA.get(key).label) !== clean(c.label)) {
      connections.changed.push(
        `${describeConnection(key)}: label ${show(connA.get(key).label)} \u2192 ${show(c.label)}`,
      );
    }
  }
  for (const [key, c] of connA) if (!connB.has(key)) connections.removed.push(describeConnection(key, c.label));

  const locs = matchLocations(a.locations, b.locations);
  const changedLocations = [];
  let unchangedLocations = 0;
  for (const { a: from, b: to } of locs.pairs) {
    const changes = describeLocationChanges(from, to);
    if (changes.length) changedLocations.push({ title: to.label || 'Unnamed pin', changes });
    else unchangedLocations += 1;
  }

  const locCanon = new Map(locs.pairs.map(({ a: from, b: to }) => [from.id, to.id]));
  const linkKeys = (project, mapPin, mapIdentifier) =>
    new Set(project.pinLinks.map((l) => `${mapPin(l.pinId)}|${mapIdentifier(l.identifierId)}`));
  const linksA = linkKeys(a, (id) => locCanon.get(id) ?? `a:${id}`, canonA);
  const linksB = linkKeys(b, (id) => id, (id) => id);
  const pinLabel = (id) => {
    const pin = b.locations.find((l) => l.id === id) ?? a.locations.find((l) => l.id === id.replace(/^a:/, ''));
    return pin?.label || 'Unnamed pin';
  };
  const describeLink = (key) => {
    const [pinId, identifierId] = key.split('|');
    return `${pinLabel(pinId)} \u2194 ${nameOf(identifierId)}`;
  };
  const pinLinks = {
    added: [...linksB].filter((k) => !linksA.has(k)).map(describeLink),
    removed: [...linksA].filter((k) => !linksB.has(k)).map(describeLink),
  };

  const evidence = diffEvidence(a.evidence, b.evidence);

  const meta = { nameBefore: a.name, nameAfter: b.name, changes: [] };
  if (clean(a.name) !== clean(b.name)) meta.changes.push(`Project name: ${show(a.name)} \u2192 ${show(b.name)}`);
  if (clean(a.target.name) !== clean(b.target.name)) {
    meta.changes.push(`Target: ${show(a.target.name)} \u2192 ${show(b.target.name)}`);
  }
  if (clean(a.target.notes) !== clean(b.target.notes)) meta.changes.push('Target notes changed');

  const result = {
    meta,
    identifiers: {
      added: ids.added.map((i) => describeIdentifier(i)),
      removed: ids.removed.map((i) => describeIdentifier(i)),
      changed: changedIdentifiers,
      unchanged: unchangedIdentifiers,
    },
    connections,
    locations: {
      added: locs.added.map((l) => l.label || 'Unnamed pin'),
      removed: locs.removed.map((l) => l.label || 'Unnamed pin'),
      changed: changedLocations,
      unchanged: unchangedLocations,
    },
    pinLinks,
    evidence,
  };

  const count = (v) => (Array.isArray(v) ? v.length : 0);
  result.summary = {
    identifiers: { added: count(result.identifiers.added), removed: count(result.identifiers.removed), changed: count(result.identifiers.changed) },
    connections: { added: count(connections.added), removed: count(connections.removed), changed: count(connections.changed) },
    locations: { added: count(result.locations.added), removed: count(result.locations.removed), changed: count(result.locations.changed) },
    pinLinks: { added: count(pinLinks.added), removed: count(pinLinks.removed), changed: 0 },
    evidence: { added: count(evidence.added), removed: count(evidence.removed), changed: 0 },
  };
  result.identical =
    meta.changes.length === 0 &&
    Object.values(result.summary).every((s) => s.added + s.removed + s.changed === 0);
  return result;
}

const SECTION_TITLES = {
  identifiers: 'Identifiers',
  connections: 'Connections',
  locations: 'Locations',
  pinLinks: 'Pin links',
  evidence: 'Evidence',
};

export function buildDiffMarkdown(diff) {
  const lines = [`# Project comparison`, '', `Earlier: ${diff.meta.nameBefore}`, `Later: ${diff.meta.nameAfter}`, ''];
  if (diff.identical) {
    lines.push('No differences found.', '');
    return lines.join('\n');
  }
  if (diff.meta.changes.length) {
    lines.push('## Project', ...diff.meta.changes.map((c) => `- ${c}`), '');
  }
  const evidenceLine = (e) => `${e.date} ${e.title} (${e.source})`;
  for (const key of Object.keys(SECTION_TITLES)) {
    const s = diff.summary[key];
    if (s.added + s.removed + s.changed === 0) continue;
    lines.push(`## ${SECTION_TITLES[key]}`, `${s.added} added, ${s.removed} removed, ${s.changed} changed`, '');
    const section = diff[key];
    const render = key === 'evidence' ? evidenceLine : (x) => x;
    for (const item of section.added ?? []) lines.push(`+ ${render(item)}`);
    for (const item of section.removed ?? []) lines.push(`- ${render(item)}`);
    for (const item of section.changed ?? []) {
      if (typeof item === 'string') lines.push(`~ ${item}`);
      else lines.push(`~ ${item.title}`, ...item.changes.map((c) => `    ${c}`));
    }
    lines.push('');
  }
  return lines.join('\n');
}

