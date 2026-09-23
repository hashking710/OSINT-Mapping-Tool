import { normalizeColor } from './identifierLabels.js';

const VIEWS_FORMAT = 'osint-mapping-tool/views';

export function buildViewsExport(presets = [], now = new Date()) {
  return JSON.stringify(
    {
      format: VIEWS_FORMAT,
      version: 1,
      exportedAt: now.toISOString(),
      views: presets.map(({ name, query, tag, color }) => ({
        name,
        query: query ?? '',
        tag: tag ?? null,
        color: color ?? null,
      })),
    },
    null,
    2,
  );
}

// Returns { views, error }. Unknown or malformed entries are dropped; the
// file must carry our format marker so unrelated JSON is rejected clearly.
export function parseViewsImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { views: [], error: 'That file is not valid JSON.' };
  }
  if (!data || data.format !== VIEWS_FORMAT || !Array.isArray(data.views)) {
    return { views: [], error: 'That JSON file is not a saved-views export from this app.' };
  }
  const seen = new Set();
  const views = [];
  for (const entry of data.views) {
    const name = typeof entry?.name === 'string' ? entry.name.trim().slice(0, 40) : '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    views.push({
      name,
      query: typeof entry.query === 'string' ? entry.query : '',
      tag: typeof entry.tag === 'string' && entry.tag.trim() ? entry.tag.trim() : null,
      color: normalizeColor(entry.color),
    });
  }
  if (views.length === 0) return { views: [], error: 'No usable saved views were found in that file.' };
  return { views, error: null };
}
