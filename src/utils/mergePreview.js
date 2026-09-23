import { getDisplayLabel, getTypeDef } from '../identifierTypes.js';
import { computeLayout } from './graphLayout.js';
import { normalizeColor, normalizeTags } from './identifierLabels.js';
import { validateProject } from './projectIO.js';

export const PREVIEW_NODE_WIDTH = 200;
export const PREVIEW_NODE_HEIGHT = 54;

// The canvas layout leaves room for wide edge labels; the preview packs columns closer.
const X_SCALE = 0.7;

const clean = (value) => String(value ?? '').trim();
const pairKey = (a, b) => [a, b].sort().join('|');
const signature = (i) =>
  JSON.stringify([i.type, i.fields ?? {}, clean(i.notes), normalizeTags(i.tags), normalizeColor(i.color)]);

const locationSignature = (l) =>
  JSON.stringify([l.lat.toFixed(5), l.lng.toFixed(5), clean(l.label), clean(l.address), clean(l.visitedAt), clean(l.withWho), clean(l.notes), l.color ?? '']);

/**
 * Describe how a merged project would look next to the one it started as: every
 * identifier and connection placed with the same layout as "Tidy layout", and
 * marked as added, updated, or unchanged.
 */
export function buildMergePreview(baseInput, mergedInput) {
  const base = validateProject(baseInput);
  const merged = validateProject(mergedInput);
  const baseById = new Map(base.identifiers.map((i) => [i.id, i]));
  const baseConnections = new Map(base.connections.map((c) => [pairKey(c.source, c.target), c]));
  const layout = computeLayout(merged.identifiers, merged.connections);

  const nodes = merged.identifiers.map((identifier) => {
    const before = baseById.get(identifier.id);
    const status = !before ? 'added' : signature(before) !== signature(identifier) ? 'updated' : 'same';
    const spot = layout.get(identifier.id) ?? { x: 0, y: 0 };
    const x = Math.round(spot.x * X_SCALE);
    const y = spot.y;
    return {
      id: identifier.id,
      label: getDisplayLabel(identifier),
      type: getTypeDef(identifier.type).label,
      color: normalizeColor(identifier.color),
      status,
      x,
      y,
    };
  });

  const edges = merged.connections.map((connection) => {
    const before = baseConnections.get(pairKey(connection.source, connection.target));
    const status = !before ? 'added' : clean(before.label) !== clean(connection.label) ? 'updated' : 'same';
    return { id: connection.id, source: connection.source, target: connection.target, label: connection.label ?? '', status };
  });

  const baseLocationById = new Map(base.locations.map((l) => [l.id, l]));
  const pins = merged.locations
    .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng))
    .map((l) => {
      const before = baseLocationById.get(l.id);
      const status = !before ? 'added' : locationSignature(before) !== locationSignature(l) ? 'updated' : 'same';
      return { id: l.id, label: clean(l.label) || 'Unnamed pin', lat: l.lat, lng: l.lng, color: l.color ?? null, status };
    });

  const count = (list, status) => list.filter((item) => item.status === status).length;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const pad = 30;
  const bounds = nodes.length
    ? {
        x: Math.min(...xs) - pad,
        y: Math.min(...ys) - pad,
        width: Math.max(...xs) + PREVIEW_NODE_WIDTH - Math.min(...xs) + pad * 2,
        height: Math.max(...ys) + PREVIEW_NODE_HEIGHT - Math.min(...ys) + pad * 2,
      }
    : { x: 0, y: 0, width: PREVIEW_NODE_WIDTH, height: PREVIEW_NODE_HEIGHT };

  return {
    nodes,
    edges,
    pins,
    bounds,
    counts: {
      addedNodes: count(nodes, 'added'),
      updatedNodes: count(nodes, 'updated'),
      addedEdges: count(edges, 'added'),
      updatedEdges: count(edges, 'updated'),
      addedPins: count(pins, 'added'),
      updatedPins: count(pins, 'updated'),
    },
  };
}
