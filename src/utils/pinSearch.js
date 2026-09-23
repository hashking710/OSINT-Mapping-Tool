export function filterPinsForQuery(pins = [], query = '') {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return [...pins];

  const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  return pins.filter((pin) => {
    const haystack = [
      pin?.label ?? '',
      pin?.address ?? '',
      pin?.notes ?? '',
      pin?.withWho ?? '',
      pin?.visitedAt ?? '',
    ].join(' ').toLowerCase();

    if (terms.length === 0) return true;
    if (terms.length === 1) return haystack.includes(terms[0]);
    return terms.every((term) => haystack.includes(term));
  });
}
