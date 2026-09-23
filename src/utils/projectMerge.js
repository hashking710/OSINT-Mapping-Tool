import {
  describeIdentifierChanges,
  describeLocationChanges,
  evidenceKey,
  matchIdentifiers,
  matchLocations,
} from './projectDiff.js';
import { addTags, normalizeColor, normalizeTags } from './identifierLabels.js';
import { validateProject } from './projectIO.js';

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

/**
 * Bring changes from `incoming` into `base`. Additive by default: nothing in
 * `base` is ever deleted. Items are matched the same way the comparison
 * matches them, so merging a file you already have adds nothing.
 * Returns { project, summary, total } without touching either input.
 */
export function mergeProjects(baseInput, incomingInput, options = {}) {
  const opts = { ...DEFAULT_MERGE_OPTIONS, ...options };
  const base = validateProject(baseInput);
  const incoming = validateProject(incomingInput);
  const now = new Date().toISOString();
  const added = { identifiers: 0, connections: 0, locations: 0, pinLinks: 0, evidence: 0, views: 0 };
  const updated = { identifiers: 0, connections: 0, locations: 0 };

  // ---- identifiers
  const matched = matchIdentifiers(base.identifiers, incoming.identifiers);
  const incomingToBase = new Map(matched.pairs.map(({ a, b }) => [b.id, a.id]));
  let identifiers = base.identifiers.map((i) => ({ ...i }));

  if (opts.updateChanged) {
    for (const { a, b } of matched.pairs) {
      // Tags are merged, so only tags missing locally count as a change.
      const tagsMissing = addTags(a.tags, b.tags).length !== normalizeTags(a.tags).length;
      const otherChanges = describeIdentifierChanges(a, b).filter((c) => !c.startsWith('Tags:'));
      if (otherChanges.length === 0 && !tagsMissing) continue;
      identifiers = identifiers.map((i) =>
        i.id === a.id
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
  }
  if (opts.identifiers) {
    for (const b of matched.added) {
      identifiers.push({ ...b, position: gridPosition(identifiers.length), createdAt: b.createdAt || now, updatedAt: now });
      incomingToBase.set(b.id, b.id);
      added.identifiers += 1;
    }
  }
  const identifierIds = new Set(identifiers.map((i) => i.id));

  // ---- connections
  const connections = base.connections.map((c) => ({ ...c }));
  const connectionIndex = new Map(connections.map((c, i) => [pairKey(c.source, c.target), i]));
  for (const c of incoming.connections) {
    const source = incomingToBase.get(c.source);
    const target = incomingToBase.get(c.target);
    if (!source || !target || source === target || !identifierIds.has(source) || !identifierIds.has(target)) continue;
    const key = pairKey(source, target);
    if (connectionIndex.has(key)) {
      const at = connectionIndex.get(key);
      if (opts.updateChanged && clean(connections[at].label) !== clean(c.label)) {
        connections[at] = { ...connections[at], label: c.label ?? '' };
        updated.connections += 1;
      }
    } else if (opts.connections) {
      connectionIndex.set(key, connections.length);
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
  }

  // ---- locations
  const locMatch = matchLocations(base.locations, incoming.locations);
  const incomingLocToBase = new Map(locMatch.pairs.map(({ a, b }) => [b.id, a.id]));
  let locations = base.locations.map((l) => ({ ...l }));
  if (opts.updateChanged) {
    for (const { a, b } of locMatch.pairs) {
      if (describeLocationChanges(a, b).length === 0) continue;
      locations = locations.map((l) =>
        l.id === a.id
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
  }
  if (opts.locations) {
    for (const b of locMatch.added) {
      locations.push({ ...b, updatedAt: now });
      incomingLocToBase.set(b.id, b.id);
      added.locations += 1;
    }
  }
  const locationIds = new Set(locations.map((l) => l.id));

  // ---- pin links (follow whichever pins and identifiers exist after merging)
  const pinLinks = base.pinLinks.map((l) => ({ ...l }));
  const linkKeys = new Set(pinLinks.map((l) => `${l.pinId}|${l.identifierId}`));
  if (opts.locations) {
    for (const link of incoming.pinLinks) {
      const pinId = incomingLocToBase.get(link.pinId);
      const identifierId = incomingToBase.get(link.identifierId);
      if (!pinId || !identifierId || !locationIds.has(pinId) || !identifierIds.has(identifierId)) continue;
      const key = `${pinId}|${identifierId}`;
      if (linkKeys.has(key)) continue;
      linkKeys.add(key);
      pinLinks.push({ id: crypto.randomUUID(), pinId, identifierId, context: link.context ?? '', createdAt: link.createdAt || now });
      added.pinLinks += 1;
    }
  }

  // ---- evidence
  const evidence = base.evidence.map((e) => ({ ...e }));
  if (opts.evidence) {
    const ids = new Set(evidence.map((e) => e.id));
    const keys = new Set(evidence.map(evidenceKey));
    for (const e of incoming.evidence) {
      if (ids.has(e.id) || keys.has(evidenceKey(e))) continue;
      ids.add(e.id);
      keys.add(evidenceKey(e));
      evidence.push({ ...e });
      added.evidence += 1;
    }
  }

  // ---- saved views
  const filterPresets = base.filterPresets.map((p) => ({ ...p }));
  if (opts.views) {
    const names = new Set(filterPresets.map((p) => p.name.toLowerCase()));
    for (const p of incoming.filterPresets) {
      if (names.has(p.name.toLowerCase())) continue;
      names.add(p.name.toLowerCase());
      filterPresets.push({ ...p, id: crypto.randomUUID() });
      added.views += 1;
    }
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
