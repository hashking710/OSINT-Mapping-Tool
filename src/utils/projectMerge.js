import { evidenceKey, matchIdentifiers, matchLocations } from './projectDiff.js';
import { describeIdentifier } from './caseReport.js';
import { getTypeDef } from '../identifierTypes.js';
import { addTags, normalizeColor, normalizeTags } from './identifierLabels.js';
import { validateProject } from './projectIO.js';

// Category switches used when no explicit item selection is given.
const DEFAULT_MERGE_OPTIONS = {
  identifiers: true,
  connections: true,
  locations: true,
  evidence: true,
  views: true,
  updateChanged: false,
};

export const ALL_MERGE_OPTIONS = { ...DEFAULT_MERGE_OPTIONS, updateChanged: true };

const gridPosition = (index) => ({ x: 60 + (index % 4) * 240, y: 60 + Math.floor(index / 4) * 150 });
const pairKey = (a, b) => [a, b].sort().join('|');
const clean = (value) => String(value ?? '').trim();
const shortDate = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');
const truncate = (value, max = 60) => {
  const text = clean(value).replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const show = (value) => (clean(value) === '' ? '(empty)' : `"${truncate(value)}"`);

// One entry per property that differs, so each can be kept or taken separately.
function identifierFieldChanges(a, b) {
  const out = [];
  const defA = getTypeDef(a.type);
  const defB = getTypeDef(b.type);
  if (a.type !== b.type) {
    out.push({ id: 'type', label: 'Type', text: `Type: ${defA.label} → ${defB.label}` });
  }
  const labelFor = (key) =>
    defB.fields.find((f) => f.key === key)?.label ?? defA.fields.find((f) => f.key === key)?.label ?? key;
  for (const key of new Set([...Object.keys(a.fields ?? {}), ...Object.keys(b.fields ?? {})])) {
    const before = clean(a.fields?.[key]);
    const after = clean(b.fields?.[key]);
    if (before !== after) {
      out.push({ id: `f:${key}`, label: labelFor(key), text: `${labelFor(key)}: ${show(before)} → ${show(after)}` });
    }
  }
  if (clean(a.notes) !== clean(b.notes)) {
    out.push({ id: 'notes', label: 'Notes', text: `Notes: ${show(a.notes)} → ${show(b.notes)}` });
  }
  // Tags are merged rather than replaced, so only tags missing locally count.
  const have = new Set(normalizeTags(a.tags).map((t) => t.toLowerCase()));
  const missing = normalizeTags(b.tags).filter((t) => !have.has(t.toLowerCase()));
  if (missing.length) out.push({ id: 'tags', label: 'Tags', text: `Tags: +${missing.join(' +')}` });
  const colorA = normalizeColor(a.color);
  const colorB = normalizeColor(b.color);
  if (colorA !== colorB) {
    out.push({ id: 'color', label: 'Colour label', text: `Colour label: ${colorA ?? 'none'} → ${colorB ?? 'none'}` });
  }
  return out;
}

const LOCATION_FIELDS = [
  ['label', 'Label'],
  ['address', 'Address'],
  ['visitedAt', 'Visited'],
  ['withWho', 'With'],
  ['notes', 'Notes'],
  ['color', 'Pin colour'],
];

function locationFieldChanges(a, b) {
  const out = [];
  if (Math.abs(a.lat - b.lat) > 1e-5 || Math.abs(a.lng - b.lng) > 1e-5) {
    out.push({
      id: 'coords',
      label: 'Position',
      text: `Moved: (${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}) → (${b.lat.toFixed(5)}, ${b.lng.toFixed(5)})`,
    });
  }
  for (const [key, label] of LOCATION_FIELDS) {
    if (clean(a[key]) !== clean(b[key])) {
      out.push({ id: key, label, text: `${label}: ${show(a[key])} → ${show(b[key])}` });
    }
  }
  return out;
}

/**
 * Work out every change a merge could make, without applying any of it.
 * Each item has a stable `key` (built from the incoming project's ids), a
 * `category`, whether it adds something or `update`s a local copy, a readable
 * label, and `needs`: keys of other items it cannot exist without (a new
 * connection needs its new identifiers). Updates are one item per changed
 * property, sharing a `group` so they can be shown together.
 */
function analyze(baseInput, incomingInput) {
  const base = validateProject(baseInput);
  const incoming = validateProject(incomingInput);
  const items = [];

  // ---- identifiers
  const matched = matchIdentifiers(base.identifiers, incoming.identifiers);
  const idMap = new Map(matched.pairs.map(({ a, b }) => [b.id, a.id]));
  const addedIdentifierIds = new Set(matched.added.map((b) => b.id));
  const baseIdentifierById = new Map(base.identifiers.map((i) => [i.id, i]));
  const incomingIdentifierById = new Map(incoming.identifiers.map((i) => [i.id, i]));

  for (const { a, b } of matched.pairs) {
    const group = { key: `u:${b.id}`, label: describeIdentifier(b) };
    for (const change of identifierFieldChanges(a, b)) {
      items.push({
        key: `u:${b.id}:${change.id}`,
        category: 'identifiers',
        kind: 'update',
        label: group.label,
        fieldLabel: change.label,
        text: change.text,
        changes: [change.text],
        group,
        needs: [],
        payload: { baseId: a.id, incoming: b, field: change.id },
      });
    }
  }
  for (const b of matched.added) {
    items.push({
      key: `i:${b.id}`,
      category: 'identifiers',
      kind: 'add',
      label: describeIdentifier(b),
      needs: [],
      payload: { incoming: b },
    });
  }

  const nameOfMapped = (mappedId) => {
    const identifier = baseIdentifierById.get(mappedId) ?? incomingIdentifierById.get(mappedId);
    return identifier ? describeIdentifier(identifier) : 'Unknown identifier';
  };
  const mapIdentifier = (incomingId) => idMap.get(incomingId) ?? (addedIdentifierIds.has(incomingId) ? incomingId : null);
  const identifierNeed = (incomingId) => (addedIdentifierIds.has(incomingId) ? [`i:${incomingId}`] : []);

  // ---- connections
  const baseConnections = new Map(base.connections.map((c) => [pairKey(c.source, c.target), c]));
  const seenConnections = new Set();
  for (const c of incoming.connections) {
    const source = mapIdentifier(c.source);
    const target = mapIdentifier(c.target);
    if (!source || !target || source === target) continue;
    const key = pairKey(source, target);
    if (seenConnections.has(key)) continue;
    seenConnections.add(key);
    const title = `${nameOfMapped(source)} — ${nameOfMapped(target)}`;
    const existing = baseConnections.get(key);
    if (existing) {
      if (clean(existing.label) !== clean(c.label)) {
        const text = `Label: ${show(existing.label)} → ${show(c.label)}`;
        items.push({
          key: `cu:${c.id}`,
          category: 'connections',
          kind: 'update',
          label: title,
          fieldLabel: 'Label',
          text,
          changes: [text],
          group: { key: `cu:${c.id}`, label: title },
          needs: [],
          payload: { baseConnectionId: existing.id, incoming: c },
        });
      }
    } else {
      items.push({
        key: `c:${c.id}`,
        category: 'connections',
        kind: 'add',
        label: c.label ? `${title} [${c.label}]` : title,
        needs: [...identifierNeed(c.source), ...identifierNeed(c.target)],
        payload: { source, target, incoming: c },
      });
    }
  }

  // ---- locations
  const locMatch = matchLocations(base.locations, incoming.locations);
  const locMap = new Map(locMatch.pairs.map(({ a, b }) => [b.id, a.id]));
  const addedLocationIds = new Set(locMatch.added.map((l) => l.id));
  const baseLocationById = new Map(base.locations.map((l) => [l.id, l]));
  const incomingLocationById = new Map(incoming.locations.map((l) => [l.id, l]));

  for (const { a, b } of locMatch.pairs) {
    const group = { key: `lu:${b.id}`, label: b.label || 'Unnamed pin' };
    for (const change of locationFieldChanges(a, b)) {
      items.push({
        key: `lu:${b.id}:${change.id}`,
        category: 'locations',
        kind: 'update',
        label: group.label,
        fieldLabel: change.label,
        text: change.text,
        changes: [change.text],
        group,
        needs: [],
        payload: { baseId: a.id, incoming: b, field: change.id },
      });
    }
  }
  for (const b of locMatch.added) {
    items.push({
      key: `l:${b.id}`,
      category: 'locations',
      kind: 'add',
      label: b.label || 'Unnamed pin',
      needs: [],
      payload: { incoming: b },
    });
  }

  // ---- pin links
  const baseLinkKeys = new Set(base.pinLinks.map((l) => `${l.pinId}|${l.identifierId}`));
  const seenLinks = new Set();
  const pinName = (mappedId) => (baseLocationById.get(mappedId) ?? incomingLocationById.get(mappedId))?.label || 'Unnamed pin';
  for (const link of incoming.pinLinks) {
    const pinId = locMap.get(link.pinId) ?? (addedLocationIds.has(link.pinId) ? link.pinId : null);
    const identifierId = mapIdentifier(link.identifierId);
    if (!pinId || !identifierId) continue;
    const key = `${pinId}|${identifierId}`;
    if (baseLinkKeys.has(key) || seenLinks.has(key)) continue;
    seenLinks.add(key);
    items.push({
      key: `p:${link.id}`,
      category: 'pinLinks',
      kind: 'add',
      label: `${pinName(pinId)} ↔ ${nameOfMapped(identifierId)}`,
      needs: [...(addedLocationIds.has(link.pinId) ? [`l:${link.pinId}`] : []), ...identifierNeed(link.identifierId)],
      payload: { pinId, identifierId, incoming: link },
    });
  }

  // ---- evidence
  const evidenceIds = new Set(base.evidence.map((e) => e.id));
  const evidenceKeys = new Set(base.evidence.map(evidenceKey));
  for (const e of incoming.evidence) {
    if (evidenceIds.has(e.id) || evidenceKeys.has(evidenceKey(e))) continue;
    evidenceIds.add(e.id);
    evidenceKeys.add(evidenceKey(e));
    items.push({
      key: `e:${e.id}`,
      category: 'evidence',
      kind: 'add',
      label: `${shortDate(e.createdAt)} ${e.title} (${e.source})`,
      needs: [],
      payload: { incoming: e },
    });
  }

  // ---- saved views
  const viewNames = new Set(base.filterPresets.map((p) => p.name.toLowerCase()));
  for (const p of incoming.filterPresets) {
    if (viewNames.has(p.name.toLowerCase())) continue;
    viewNames.add(p.name.toLowerCase());
    items.push({
      key: `v:${p.name.toLowerCase()}`,
      category: 'views',
      kind: 'add',
      label: p.name,
      needs: [],
      payload: { incoming: p },
    });
  }

  return { base, incoming, items };
}

/** Keys that are effectively selected: a chosen item is dropped if anything it needs is not. */
export function resolveSelection(items, selected) {
  const chosen = new Set(selected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (chosen.has(item.key) && item.needs.some((need) => !chosen.has(need))) {
        chosen.delete(item.key);
        changed = true;
      }
    }
  }
  return chosen;
}

// Which items the simple category switches would pick.
function keysFromOptions(items, opts) {
  const chosen = new Set();
  for (const item of items) {
    const flag =
      item.kind === 'update'
        ? opts.updateChanged
        : item.category === 'pinLinks'
          ? opts.locations
          : opts[item.category];
    if (flag) chosen.add(item.key);
  }
  return chosen;
}

/** Everything a merge could change, for showing a review list. */
export function planMerge(baseInput, incomingInput) {
  return analyze(baseInput, incomingInput).items.map(({ payload: _payload, ...item }) => item);
}

function applyIdentifierField(identifier, incoming, field, now) {
  const next = { ...identifier, updatedAt: now };
  if (field === 'type') next.type = incoming.type;
  else if (field === 'notes') next.notes = incoming.notes ?? '';
  else if (field === 'color') next.color = normalizeColor(incoming.color);
  else if (field === 'tags') next.tags = addTags(identifier.tags, incoming.tags);
  else if (field.startsWith('f:')) {
    const key = field.slice(2);
    next.fields = { ...identifier.fields, [key]: incoming.fields?.[key] ?? '' };
  }
  return next;
}

function applyLocationField(location, incoming, field, now) {
  const next = { ...location, updatedAt: now };
  if (field === 'coords') {
    next.lat = incoming.lat;
    next.lng = incoming.lng;
  } else {
    next[field] = incoming[field];
  }
  return next;
}

/**
 * Bring changes from `incoming` into `base`. Additive by default: nothing in
 * `base` is ever deleted. Pass `options.keys` (a Set of item keys from
 * planMerge) to choose exact items; otherwise the category switches decide.
 * Returns { project, summary, total } without touching either input.
 */
export function mergeProjects(baseInput, incomingInput, options = {}) {
  const opts = { ...DEFAULT_MERGE_OPTIONS, ...options };
  const { base, items } = analyze(baseInput, incomingInput);
  const selected = resolveSelection(items, opts.keys ? new Set(opts.keys) : keysFromOptions(items, opts));
  const now = new Date().toISOString();
  const added = { identifiers: 0, connections: 0, locations: 0, pinLinks: 0, evidence: 0, views: 0 };
  const chosen = items.filter((item) => selected.has(item.key));
  const of = (category, kind) => chosen.filter((item) => item.category === category && item.kind === kind);
  const touched = { identifiers: new Set(), connections: new Set(), locations: new Set() };

  let identifiers = base.identifiers.map((i) => ({ ...i }));
  for (const item of of('identifiers', 'update')) {
    const { baseId, incoming: b, field } = item.payload;
    identifiers = identifiers.map((i) => (i.id === baseId ? applyIdentifierField(i, b, field, now) : i));
    touched.identifiers.add(baseId);
  }
  for (const item of of('identifiers', 'add')) {
    const { incoming: b } = item.payload;
    identifiers.push({ ...b, position: gridPosition(identifiers.length), createdAt: b.createdAt || now, updatedAt: now });
    added.identifiers += 1;
  }

  const connections = base.connections.map((c) => ({ ...c }));
  for (const item of of('connections', 'update')) {
    const { baseConnectionId, incoming: c } = item.payload;
    const at = connections.findIndex((x) => x.id === baseConnectionId);
    if (at >= 0) connections[at] = { ...connections[at], label: c.label ?? '' };
    touched.connections.add(baseConnectionId);
  }
  for (const item of of('connections', 'add')) {
    const { source, target, incoming: c } = item.payload;
    connections.push({
      id: crypto.randomUUID(),
      source,
      target,
      sourceHandle: c.sourceHandle ?? null,
      targetHandle: c.targetHandle ?? null,
      label: c.label ?? '',
    });
    added.connections += 1;
  }

  let locations = base.locations.map((l) => ({ ...l }));
  for (const item of of('locations', 'update')) {
    const { baseId, incoming: b, field } = item.payload;
    locations = locations.map((l) => (l.id === baseId ? applyLocationField(l, b, field, now) : l));
    touched.locations.add(baseId);
  }
  for (const item of of('locations', 'add')) {
    locations.push({ ...item.payload.incoming, updatedAt: now });
    added.locations += 1;
  }

  const pinLinks = base.pinLinks.map((l) => ({ ...l }));
  for (const item of of('pinLinks', 'add')) {
    const { pinId, identifierId, incoming: link } = item.payload;
    pinLinks.push({ id: crypto.randomUUID(), pinId, identifierId, context: link.context ?? '', createdAt: link.createdAt || now });
    added.pinLinks += 1;
  }

  const evidence = base.evidence.map((e) => ({ ...e }));
  for (const item of of('evidence', 'add')) {
    evidence.push({ ...item.payload.incoming });
    added.evidence += 1;
  }

  const filterPresets = base.filterPresets.map((p) => ({ ...p }));
  for (const item of of('views', 'add')) {
    filterPresets.push({ ...item.payload.incoming, id: crypto.randomUUID() });
    added.views += 1;
  }

  const updated = {
    identifiers: touched.identifiers.size,
    connections: touched.connections.size,
    locations: touched.locations.size,
  };
  const summary = { added, updated };
  const total =
    Object.values(added).reduce((n, v) => n + v, 0) + Object.values(updated).reduce((n, v) => n + v, 0);
  return {
    project: { ...base, identifiers, connections, locations, pinLinks, evidence, filterPresets },
    summary,
    total,
  };
}

/**
 * Fold several project files into one incoming project, in order. Later files
 * win where they disagree (their changes are applied over earlier ones), so
 * the merge review shows a single combined result.
 */
export function combineProjects(projects) {
  if (projects.length === 0) return null;
  return projects
    .slice(1)
    .reduce((acc, next) => mergeProjects(acc, next, ALL_MERGE_OPTIONS).project, validateProject(projects[0]));
}

export { describeMergeSummary } from './mergeSummary.js';
