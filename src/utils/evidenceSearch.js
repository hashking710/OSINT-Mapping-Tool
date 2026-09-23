export function filterEvidence(entries = [], query = '') {
  const terms = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...entries];

  return entries.filter((entry) => {
    const haystack = [entry.title, entry.subtitle, entry.text, entry.source, entry.sourceUrl]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
