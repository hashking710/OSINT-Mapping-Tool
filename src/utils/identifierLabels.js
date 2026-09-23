import { PIN_COLORS } from '../pinColors.js';

// Colour labels reuse the pin palette (minus white/black, which vanish on
// light and dark backgrounds respectively).
export const LABEL_COLORS = Object.keys(PIN_COLORS).filter((key) => key !== 'white' && key !== 'black');

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 30;

export function normalizeColor(value) {
  return LABEL_COLORS.includes(value) ? value : null;
}

// Accepts an array or a comma/semicolon separated string. Tags are trimmed,
// de-duplicated case-insensitively (first spelling wins), and length-limited.
export function normalizeTags(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(/[,;]/);
  const seen = new Set();
  const tags = [];
  for (const item of raw) {
    const tag = String(item ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

export function hasTag(identifier, tag) {
  const wanted = String(tag ?? '').toLowerCase();
  return (identifier?.tags ?? []).some((t) => String(t).toLowerCase() === wanted);
}

// Tags in use with counts, most used first, then alphabetical.
export function collectTags(identifiers = []) {
  const counts = new Map();
  for (const identifier of identifiers) {
    for (const tag of normalizeTags(identifier.tags)) {
      const key = tag.toLowerCase();
      const entry = counts.get(key) ?? { tag, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' }),
  );
}

export function collectColors(identifiers = []) {
  const used = new Set(identifiers.map((i) => normalizeColor(i.color)).filter(Boolean));
  return LABEL_COLORS.filter((color) => used.has(color));
}

export function filterIdentifiersByLabels(identifiers = [], { tag = null, color = null } = {}) {
  return identifiers.filter(
    (identifier) => (!tag || hasTag(identifier, tag)) && (!color || identifier.color === color),
  );
}

export function addTags(current, toAdd) {
  return normalizeTags([...normalizeTags(current), ...normalizeTags(toAdd)]);
}

export function removeTags(current, toRemove) {
  const drop = new Set(normalizeTags(toRemove).map((t) => t.toLowerCase()));
  return normalizeTags(current).filter((t) => !drop.has(t.toLowerCase()));
}

export const UNTAGGED_LABEL = 'Untagged';
export const NO_COLOR_LABEL = 'No colour label';

// Groups items by tag. An item with several tags appears in each of its
// groups. Bigger groups first, then alphabetical; untagged items come last.
export function groupItemsByTag(items = [], getTags = (item) => item.tags) {
  const groups = new Map();
  const untagged = [];
  for (const item of items) {
    const tags = normalizeTags(getTags(item));
    if (tags.length === 0) untagged.push(item);
    for (const tag of tags) {
      const key = tag.toLowerCase();
      if (!groups.has(key)) groups.set(key, { name: tag, items: [] });
      groups.get(key).items.push(item);
    }
  }
  const sorted = [...groups.values()].sort(
    (a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
  if (untagged.length) sorted.push({ name: UNTAGGED_LABEL, items: untagged });
  return sorted;
}

// Groups items by colour label in palette order; unlabelled items come last.
export function groupItemsByColor(items = [], getColor = (item) => item.color) {
  const groups = [];
  for (const color of LABEL_COLORS) {
    const matching = items.filter((item) => normalizeColor(getColor(item)) === color);
    if (matching.length) groups.push({ name: PIN_COLORS[color].name, items: matching });
  }
  const none = items.filter((item) => !normalizeColor(getColor(item)));
  if (none.length) groups.push({ name: NO_COLOR_LABEL, items: none });
  return groups;
}
