import { LABEL_COLORS, hasTag, normalizeColor, normalizeTags } from './identifierLabels.js';

// Identifiers linked to a pin (through pinLinks).
export function linkedIdentifiersFor(pinId, pinLinks = [], identifiers = []) {
  const byId = new Map(identifiers.map((i) => [i.id, i]));
  return pinLinks
    .filter((link) => link.pinId === pinId)
    .map((link) => byId.get(link.identifierId))
    .filter(Boolean);
}

// Tags and colours carried by identifiers linked to at least one pin, with
// the number of pins each applies to.
export function collectPinLabelOptions(pins = [], pinLinks = [], identifiers = []) {
  const tagCounts = new Map();
  const colors = new Set();
  for (const pin of pins) {
    const pinTags = new Map();
    for (const identifier of linkedIdentifiersFor(pin.id, pinLinks, identifiers)) {
      for (const tag of normalizeTags(identifier.tags)) {
        if (!pinTags.has(tag.toLowerCase())) pinTags.set(tag.toLowerCase(), tag);
      }
      const color = normalizeColor(identifier.color);
      if (color) colors.add(color);
    }
    for (const [key, tag] of pinTags) {
      const entry = tagCounts.get(key) ?? { tag, count: 0 };
      entry.count += 1;
      tagCounts.set(key, entry);
    }
  }
  return {
    tags: [...tagCounts.values()].sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' }),
    ),
    colors: LABEL_COLORS.filter((color) => colors.has(color)),
  };
}

// A pin matches when any one of its linked identifiers satisfies the filter
// (both tag and colour, when both are set, must come from the same identifier).
export function filterPinsByLabels(pins = [], pinLinks = [], identifiers = [], { tag = null, color = null } = {}) {
  if (!tag && !color) return [...pins];
  return pins.filter((pin) =>
    linkedIdentifiersFor(pin.id, pinLinks, identifiers).some(
      (identifier) => (!tag || hasTag(identifier, tag)) && (!color || identifier.color === color),
    ),
  );
}
