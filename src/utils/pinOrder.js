export const PIN_SORT_OPTIONS = [
  { value: 'added', label: 'Custom order' },
  { value: 'visited', label: 'Visited date' },
  { value: 'name', label: 'Name' },
];

const displayName = (pin) => (pin.label || pin.address || '').trim();

function visitedTime(pin) {
  const time = Date.parse(pin.visitedAt ?? '');
  return Number.isNaN(time) ? null : time;
}

// Stable sort; pins without a parseable visited date always go last.
export function sortPins(pins = [], mode = 'added') {
  const list = [...pins];
  if (mode === 'visited') {
    return list
      .map((pin, index) => ({ pin, index, time: visitedTime(pin) }))
      .sort((a, b) => {
        if (a.time === null && b.time === null) return a.index - b.index;
        if (a.time === null) return 1;
        if (b.time === null) return -1;
        return a.time - b.time || a.index - b.index;
      })
      .map((entry) => entry.pin);
  }
  if (mode === 'name') {
    return list
      .map((pin, index) => ({ pin, index }))
      .sort((a, b) =>
        displayName(a.pin).localeCompare(displayName(b.pin), undefined, { sensitivity: 'base' }) ||
        a.index - b.index)
      .map((entry) => entry.pin);
  }
  return list;
}

// Move the item with `fromId` so it takes the slot currently held by `toId`.
export function reorderById(items = [], fromId, toId) {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from === -1 || to === -1 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
