import {
  describeIdentifierChanges,
  describeLocationChanges,
  evidenceKey,
  matchIdentifiers,
  matchLocations,
} from './projectDiff.js';
import { describeIdentifier } from './caseReport.js';
import { addTags, normalizeColor, normalizeTags } from './identifierLabels.js';
import { validateProject } from './projectIO.js';

// Category switches used when no explicit item selection is given.
export const DEFAULT_MERGE_OPTIONS = {
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
const show = (value) => (clean(value) === '' ? '(empty)' : `"${clean(value)}"`);
const shortDate = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

/**
 * Work out every change a merge could make, without applying any of it.
 * Each item has a stable `key` (built from the incoming project's ids), a
 * `category`, whether it adds something or `update`s a local copy, a readable
 * label, and `needs`: keys of other items it cannot exist without (a new
 * connection needs its new identifiers).
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
    // Tags are merged, so only tags missing locally count as a change.
    const tagsMissing = addTags(a.tags, b.tags).length !== normalizeTags(a.tags).length;
    const changes = describeIdentifierChanges(a, b).filter((c) => !c.startsWith('Tags:'));
    if (tagsMissing) {
      const missing = normalizeTags(b.tags).filter(
        (t) => !normalizeTags(a.tags).some((x) => x.toLowerCase() === t.toLowerCase()),
      );
      changes.push(`Tags: +${missing.join(' +')}`);
    }
    if (changes.length === 0) continue;
    items.push({
      key: `u:${b.id}`,
      category: 'identifiers',
      kind: 'update',
      label: describeIdentifier(b),
      changes,
      needs: [],
      payload: { baseId: a.id, incoming: b },
    });
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
        items.push({
          key: `cu:${c.id}`,
          category: 'connections',
          kind: 'update',
          label: title,
          changes: [`Label: ${show(existing.label)} → ${show(c.label)}`],
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
    const changes = describeLocationChanges(a, b);
    if (changes.length === 0) continue;
    items.push({
      key: `lu:${b.id}`,
      category: 'locations',
      kind: 'update',
      label: b.label || 'Unnamed pin',
      changes,
      needs: [],
      payload: { baseId: a.id, incoming: b },
    });
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
  return analyze(baseInput, incomingInput).items.map(({ payload, ...item }) => item);
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
  const updated = { identifiers: 0, connections: 0, locations: 0 };
  const chosen = items.filter((item) => selected.has(item.key));
  const of = (category, kind) => chosen.filter((item) => item.category === category && item.kind === kind);

  let identifiers = base.identifiers.map((i) => ({ ...i }));
  for (const item of of('identifiers', 'update')) {
    const { baseId, incoming: b } = item.payload;
    identifiers = identifiers.map((i) =>
      i.id === baseId
        ? {
            ...i,
            type: b.type,
            fields: { ...b.fields },
            notes: b.notes ?? '',
            color: normalizeColor(b.color),
            tags: addTags(i.tags, b.tags),
            updatedAt: now,
          }
        : i,
    );
    updated.identifiers += 1;
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
    updated.connections += 1;
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
    const { baseId, incoming: b } = item.payload;
    locations = locations.map((l) =>
      l.id === baseId
        ? {
            ...l,
            label: b.label,
            address: b.address,
            lat: b.lat,
            lng: b.lng,
            visitedAt: b.visitedAt,
            withWho: b.withWho,
            notes: b.notes,
            color: b.color,
            updatedAt: now,
          }
        : l,
    );
    updated.locations += 1;
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

  const summary = { added, updated };
  const total =
    Object.values(added).reduce((n, v) => n + v, 0) + Object.values(updated).reduce((n, v) => n + v, 0);
  return {
    project: { ...base, identifiers, connections, locations, pinLinks, evidence, filterPresets },
    summary,
    total,
  };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function describeMergeSummary({ added, updated }) {
  const parts = [];
  if (added.identifiers) parts.push(`+${plural(added.identifiers, 'identifier')}`);
  if (added.connections) parts.push(`+${plural(added.connections, 'connection')}`);
  if (added.locations) parts.push(`+${plural(added.locations, 'location')}`);
  if (added.pinLinks) parts.push(`+${plural(added.pinLinks, 'pin link')}`);
  if (added.evidence) parts.push(`+${plural(added.evidence, 'evidence entry', 'evidence entries')}`);
  if (added.views) parts.push(`+${plural(added.views, 'saved view')}`);
  const changed = updated.identifiers + updated.connections + updated.locations;
  if (changed) parts.push(`${changed} updated`);
  return parts.length ? parts.join(', ') : 'nothing to merge';
}
