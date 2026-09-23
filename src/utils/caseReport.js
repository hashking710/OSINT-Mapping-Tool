import { getDisplayLabel, getTypeDef } from '../identifierTypes.js';
import { validateProject } from './projectIO.js';

const shortDate = (iso) => (typeof iso === 'string' && iso ? iso.slice(0, 10) : '');

export function describeIdentifier(identifier) {
  const def = getTypeDef(identifier.type);
  const label = getDisplayLabel(identifier);
  return label === def.label ? def.label : `${label} (${def.label})`;
}

// One shared, renderer-agnostic description of the case so the Markdown and
// HTML reports can never drift apart.
export function buildCaseReportModel(project) {
  const safe = validateProject(project);
  const { identifiers, connections, locations, pinLinks } = safe;
  const identifierById = new Map(identifiers.map((i) => [i.id, i]));
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const evidence = safe.evidence
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    title: safe.name,
    target: safe.target.name || 'Unspecified target',
    targetNotes: safe.target.notes.trim(),
    created: shortDate(safe.createdAt),
    updated: shortDate(safe.updatedAt),
    counts: {
      identifiers: identifiers.length,
      connections: connections.length,
      locations: locations.length,
      evidence: evidence.length,
    },
    identifiers: identifiers.map((identifier) => {
      const def = getTypeDef(identifier.type);
      return {
        title: describeIdentifier(identifier),
        details: def.fields
          .map((field) => ({ label: field.label, value: identifier.fields?.[field.key] }))
          .filter(({ value }) => value !== undefined && value !== null && String(value).trim() !== '')
          .map(({ label, value }) => ({ label, value: String(value).trim() })),
        notes: identifier.notes?.trim() ?? '',
        connected: connections
          .filter((c) => c.source === identifier.id || c.target === identifier.id)
          .map((c) => {
            const other = identifierById.get(c.source === identifier.id ? c.target : c.source);
            if (!other) return null;
            return c.label ? `${describeIdentifier(other)} [${c.label}]` : describeIdentifier(other);
          })
          .filter(Boolean),
        pins: pinLinks
          .filter((l) => l.identifierId === identifier.id)
          .map((l) => locationById.get(l.pinId)?.label || 'Unnamed pin'),
      };
    }),
    locations: locations.map((location) => ({
      title: location.label || 'Unnamed pin',
      coords: `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
      address: location.address || '',
      visited: location.visitedAt || '',
      withWho: location.withWho || '',
      notes: location.notes?.trim() ?? '',
      linked: pinLinks
        .filter((l) => l.pinId === location.id)
        .map((l) => {
          const who = identifierById.get(l.identifierId);
          if (!who) return null;
          return l.context ? `${describeIdentifier(who)} (${l.context})` : describeIdentifier(who);
        })
        .filter(Boolean),
    })),
    evidence: evidence.map((entry) => ({
      date: shortDate(entry.createdAt),
      title: entry.title,
      subtitle: entry.subtitle,
      text: entry.text,
      source: entry.source,
      sourceUrl: entry.sourceUrl,
    })),
  };
}

export function buildCaseReport(project) {
  const m = buildCaseReportModel(project);
  const lines = [`# Case report: ${m.title}`, '', `Target: ${m.target}`];
  if (m.targetNotes) lines.push(`Target notes: ${m.targetNotes}`);
  lines.push(
    `Created: ${m.created}  |  Last updated: ${m.updated}`,
    `Summary: ${m.counts.identifiers} identifiers, ${m.counts.connections} connections, ` +
      `${m.counts.locations} locations, ${m.counts.evidence} evidence entries`,
    '',
    '## Identifiers',
  );

  if (m.identifiers.length === 0) lines.push('None recorded.');
  m.identifiers.forEach((item, index) => {
    lines.push('', `${index + 1}. ${item.title}`);
    item.details.forEach(({ label, value }) => lines.push(`   - ${label}: ${value}`));
    if (item.notes) lines.push(`   - Notes: ${item.notes}`);
    if (item.connected.length) lines.push(`   - Connected to: ${item.connected.join('; ')}`);
    if (item.pins.length) lines.push(`   - Linked locations: ${item.pins.join('; ')}`);
  });

  lines.push('', '## Locations');
  if (m.locations.length === 0) lines.push('None recorded.');
  m.locations.forEach((item, index) => {
    lines.push('', `${index + 1}. ${item.title} (${item.coords})`);
    if (item.address) lines.push(`   - Address: ${item.address}`);
    if (item.visited) lines.push(`   - Visited: ${item.visited}`);
    if (item.withWho) lines.push(`   - With: ${item.withWho}`);
    if (item.notes) lines.push(`   - Notes: ${item.notes}`);
    if (item.linked.length) lines.push(`   - Linked identifiers: ${item.linked.join('; ')}`);
  });

  lines.push('', '## Timeline of evidence');
  if (m.evidence.length === 0) lines.push('No evidence entries captured yet.');
  m.evidence.forEach((entry, index) => {
    const heading = `${index + 1}. ${entry.date} - ${entry.title}`;
    lines.push('', entry.subtitle ? `${heading} - ${entry.subtitle}` : heading);
    lines.push(`   ${entry.text}`);
    lines.push(`   Source: ${entry.source}${entry.sourceUrl ? ` (${entry.sourceUrl})` : ''}`);
  });

  return `${lines.join('\n')}\n`;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
const escBreaks = (value) => esc(value).replace(/\r?\n/g, '<br>');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const safeUrl = (url) => (/^https?:\/\//i.test(url ?? '') ? url : '');

const REPORT_CSS = `
@page { margin: 16mm; }
* { box-sizing: border-box; }
body { font: 13px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; max-width: 800px; margin: 0 auto; padding: 28px; }
h1 { font-size: 24px; margin: 0 0 4px; }
h2 { font-size: 16px; margin: 28px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #111; break-after: avoid; }
h3 { font-size: 14px; margin: 0 0 4px; }
.meta { color: #555; font-size: 12px; margin: 2px 0; }
.summary { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 0; padding: 0; list-style: none; }
.summary li { border: 1px solid #bbb; border-radius: 999px; padding: 2px 11px; font-size: 12px; }
.item { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; margin: 8px 0; break-inside: avoid; }
.item dl { display: grid; grid-template-columns: 150px 1fr; gap: 2px 14px; margin: 6px 0 0; }
.item dt { color: #555; }
.item dd { margin: 0; overflow-wrap: anywhere; }
.empty { color: #777; font-style: italic; }
.evidence-meta { color: #555; font-size: 12px; margin-top: 4px; }
.subtitle { color: #555; font-weight: normal; }
a { color: #0645ad; }
footer { margin-top: 32px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 11px; color: #777; }
@media print { body { padding: 0; } a { color: inherit; text-decoration: none; } }
`;

function detailRows(rows) {
  const filled = rows.filter(([, value]) => value && (!Array.isArray(value) || value.length));
  if (filled.length === 0) return '';
  return `<dl>${filled
    .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${escBreaks(Array.isArray(value) ? value.join('; ') : value)}</dd>`)
    .join('')}</dl>`;
}

export function buildCaseReportHtml(project, { generatedAt = new Date() } = {}) {
  const m = buildCaseReportModel(project);
  const parts = [];

  parts.push(`<h1>${esc(m.title)}</h1>`);
  parts.push(`<p class="meta"><strong>Target:</strong> ${esc(m.target)}</p>`);
  if (m.targetNotes) parts.push(`<p class="meta">${escBreaks(m.targetNotes)}</p>`);
  parts.push(`<p class="meta">Created ${esc(m.created)} &middot; Last updated ${esc(m.updated)}</p>`);
  parts.push(
    `<ul class="summary"><li>${plural(m.counts.identifiers, 'identifier')}</li>` +
      `<li>${plural(m.counts.connections, 'connection')}</li><li>${plural(m.counts.locations, 'location')}</li>` +
      `<li>${plural(m.counts.evidence, 'evidence entry', 'evidence entries')}</li></ul>`,
  );

  parts.push('<h2>Identifiers</h2>');
  if (m.identifiers.length === 0) parts.push('<p class="empty">None recorded.</p>');
  m.identifiers.forEach((item) => {
    parts.push(
      `<div class="item"><h3>${esc(item.title)}</h3>${detailRows([
        ...item.details.map(({ label, value }) => [label, value]),
        ['Notes', item.notes],
        ['Connected to', item.connected],
        ['Linked locations', item.pins],
      ])}</div>`,
    );
  });

  parts.push('<h2>Locations</h2>');
  if (m.locations.length === 0) parts.push('<p class="empty">None recorded.</p>');
  m.locations.forEach((item) => {
    parts.push(
      `<div class="item"><h3>${esc(item.title)} <span class="subtitle">(${esc(item.coords)})</span></h3>${detailRows([
        ['Address', item.address],
        ['Visited', item.visited],
        ['With', item.withWho],
        ['Notes', item.notes],
        ['Linked identifiers', item.linked],
      ])}</div>`,
    );
  });

  parts.push('<h2>Timeline of evidence</h2>');
  if (m.evidence.length === 0) parts.push('<p class="empty">No evidence entries captured yet.</p>');
  m.evidence.forEach((entry) => {
    const url = safeUrl(entry.sourceUrl);
    const source = url
      ? `${esc(entry.source)} (<a href="${esc(url)}">${esc(url)}</a>)`
      : esc(entry.source);
    parts.push(
      `<div class="item"><h3>${esc(entry.date)} &ndash; ${esc(entry.title)}` +
        `${entry.subtitle ? ` <span class="subtitle">&ndash; ${esc(entry.subtitle)}</span>` : ''}</h3>` +
        `<div>${escBreaks(entry.text)}</div><div class="evidence-meta">Source: ${source}</div></div>`,
    );
  });

  parts.push(
    `<footer>Generated by OSINT Mapping Tool on ${esc(generatedAt.toISOString().slice(0, 10))}. ` +
      'Verify every finding against primary sources before relying on it.</footer>',
  );

  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">' +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(m.title)} - case report</title>` +
    `<style>${REPORT_CSS}</style></head><body>${parts.join('\n')}</body></html>`
  );
}
