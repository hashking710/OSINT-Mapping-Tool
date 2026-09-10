const WIKIDATA_ENDPOINT = 'https://www.wikidata.org/w/api.php';
const WIKIPEDIA_SUMMARY_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/page/summary';

export function pickBestWikidataResult(payload, query) {
  const items = Array.isArray(payload?.search) ? payload.search : [];
  if (items.length === 0) return null;

  const normalized = (value = '') => String(value).trim().toLowerCase();
  const target = normalized(query);

  const score = (item) => {
    const label = normalized(item?.label);
    const description = normalized(item?.description ?? '');
    let total = 0;
    if (label && label === target) total += 100;
    if (label && label.startsWith(target)) total += 30;
    if (description && description.includes(target)) total += 10;
    if (item?.match?.type === 'alias') total += 5;
    return total;
  };

  return [...items].sort((a, b) => score(b) - score(a) || normalized(a?.label).localeCompare(normalized(b?.label)))[0] ?? null;
}

export function summarizeOverpassMatches(items = []) {
  return items
    .map((entry) => {
      const tags = entry?.tags ?? {};
      const name = String(tags.name || tags['name:en'] || '').trim();
      const kind = Object.entries(tags).find(([key, value]) => {
        if (!value || value === 'yes') return false;
        return key === 'amenity' || key === 'tourism' || key === 'shop' || key === 'building' || key === 'leisure' || key === 'office';
      })?.[1];

      if (!name) return null;
      return { name, kind: String(kind || 'place') };
    })
    .filter(Boolean)
    .slice(0, 5);
}

export async function searchWikidata(query, language = 'en') {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language,
    format: 'json',
    origin: '*',
    limit: '5',
  });

  const response = await fetch(`${WIKIDATA_ENDPOINT}?${params.toString()}`);
  if (!response.ok) throw new Error(`Wikidata search failed: ${response.status}`);
  return response.json();
}

export async function fetchWikipediaSummary(title) {
  const response = await fetch(`${WIKIPEDIA_SUMMARY_ENDPOINT}/${encodeURIComponent(title)}`);
  if (!response.ok) throw new Error(`Wikipedia summary failed: ${response.status}`);
  return response.json();
}

export async function queryNearbyPlaces({ lat, lng, radius = 300, tags = ['amenity', 'tourism', 'shop'] }) {
  const tagFilter = tags
    .map((tag) => `[${tag}]`)
    .join('');

  const latSpan = Math.max(0.01, radius / 111000); 
  const lngSpan = Math.max(0.01, radius / (111000 * Math.cos((lat * Math.PI) / 180 || 1)));

  const query = `
    [out:json][timeout:25];
    (
      node(${lat - latSpan}, ${lng - lngSpan}, ${lat + latSpan}, ${lng + lngSpan})${tagFilter};
      way(${lat - latSpan}, ${lng - lngSpan}, ${lat + latSpan}, ${lng + lngSpan})${tagFilter};
      relation(${lat - latSpan}, ${lng - lngSpan}, ${lat + latSpan}, ${lng + lngSpan})${tagFilter};
    );
    out center tags 20;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) throw new Error(`Overpass query failed: ${response.status}`);
  const payload = await response.json();
  return payload?.elements ?? [];
}

export function buildPublicEntitySummary(entity, query = '') {
  const label = String(entity?.label || query || 'Public record').trim();
  const description = String(entity?.description || '').trim();
  const summaryText = String(entity?.summary || '').trim();
  const sourceUrl = String(entity?.url || '').trim();

  return {
    title: label || 'Public record',
    subtitle: description || 'Public record',
    text: summaryText || description || `${label || 'This record'} matched a public record.`,
    source: description ? 'Wikidata / Wikipedia' : 'Public record',
    sourceUrl: sourceUrl || null,
  };
}

export function buildNearbyPlaceSummary(place = {}, coords = {}) {
  const name = String(place?.name || 'Nearby place').trim();
  const kind = String(place?.kind || 'place').trim();
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  const sourceUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
    : null;

  return {
    title: name,
    subtitle: kind && kind !== 'place' ? kind : 'Nearby place',
    text: `${name} appears to be a nearby ${kind === 'place' ? 'location' : kind}.`,
    source: 'OpenStreetMap / Overpass',
    sourceUrl,
  };
}

export function buildEvidenceNote(summary, contextLabel = 'Public record') {
  const title = String(summary?.title || '').trim();
  const subtitle = String(summary?.subtitle || '').trim();
  const text = String(summary?.text || '').trim();
  const source = String(summary?.source || 'Public source').trim();
  const sourceUrl = String(summary?.sourceUrl || '').trim();
  const label = String(contextLabel || 'Public record').trim();

  const heading = [title, subtitle].filter(Boolean).join(' — ') || 'Evidence';
  const sourceLine = sourceUrl ? `${source}: ${sourceUrl}` : source;

  return [
    `${label}: ${heading}`,
    text,
    `Source: ${sourceLine}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function lookupPublicEntity(query) {
  const payload = await searchWikidata(query);
  const best = pickBestWikidataResult(payload, query);
  if (!best) return null;

  let summary = '';
  try {
    const article = await fetchWikipediaSummary(best.label);
    summary = article?.extract ?? '';
  } catch {
    summary = '';
  }

  return {
    label: best.label ?? query,
    description: best.description ?? '',
    url: best.url ?? '',
    summary,
  };
}
