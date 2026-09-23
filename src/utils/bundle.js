import { buildCaseReport, buildCaseReportHtml, buildIdentifierDossier, buildCaseReportModel } from './caseReport.js';
import { buildEvidenceCsv, buildIdentifiersCsv, buildLocationsCsv } from './exportCsv.js';
import { safeFileName } from './download.js';
import { validateProject } from './projectIO.js';
import { buildViewsExport } from './viewsIO.js';
import { createZip } from './zip.js';

// Every optional part of a bundle. README.txt is always included.
export const BUNDLE_SECTIONS = [
  { key: 'html', label: 'Styled report', detail: 'case-report.html (print it to PDF from a browser)' },
  { key: 'markdown', label: 'Markdown report', detail: 'case-report.md' },
  { key: 'identifiersCsv', label: 'Identifiers spreadsheet', detail: 'identifiers.csv' },
  { key: 'locationsCsv', label: 'Locations spreadsheet', detail: 'locations.csv' },
  { key: 'evidenceCsv', label: 'Evidence spreadsheet', detail: 'evidence.csv' },
  { key: 'dossiers', label: 'Identifier dossiers', detail: 'one report per identifier that has evidence' },
  { key: 'views', label: 'Saved views', detail: 'saved-views.json' },
  { key: 'project', label: 'Full project file', detail: 'project.osint.json, to reopen in the tool' },
];

export const ALL_BUNDLE_SECTION_KEYS = BUNDLE_SECTIONS.map((s) => s.key);

const README_LINES = {
  html: '  case-report.html     Styled report (print it to PDF from your browser)',
  markdown: '  case-report.md       The same report as Markdown',
  identifiersCsv: '  identifiers.csv      Identifiers with tags, colours and relationships',
  locationsCsv: '  locations.csv        Pinned locations and who they are linked to',
  evidenceCsv: '  evidence.csv         Evidence timeline',
  dossiers: '  dossiers/            One report per identifier that has related evidence',
  views: '  saved-views.json     Saved filter views',
  project: '  project.osint.json   The full project; open it in OSINT Mapping Tool to explore',
};

function readme(project, generatedAt, included) {
  return [
    `${project.name} - report bundle`,
    `Generated ${generatedAt.toISOString().slice(0, 10)} by OSINT Mapping Tool.`,
    '',
    'This bundle is a read-only snapshot. Nothing in it phones home; open the files',
    'with any browser, text editor or spreadsheet.',
    '',
    'Contents',
    ...included.map((key) => README_LINES[key]),
    '',
    'Verify every finding against primary sources before relying on it.',
    '',
  ].join('\n');
}

// `include` limits the optional parts (defaults to all). Parts with nothing to
// put in them (no evidence, no saved views) are skipped either way.
export function buildReportBundleFiles(
  project,
  { groupBy = 'none', generatedAt = new Date(), include = ALL_BUNDLE_SECTION_KEYS } = {},
) {
  const safe = validateProject(project);
  const wanted = new Set(include);
  const model = buildCaseReportModel(safe);
  const dossierItems = model.identifiers.map((item, index) => ({ item, index })).filter(({ item }) => item.evidenceIds.length > 0);
  const hasViews = (safe.filterPresets ?? []).length > 0;

  const present = ALL_BUNDLE_SECTION_KEYS.filter((key) => {
    if (!wanted.has(key)) return false;
    if (key === 'dossiers') return dossierItems.length > 0;
    if (key === 'views') return hasViews;
    return true;
  });
  if (present.length === 0) throw new Error('Choose at least one thing to include in the bundle.');

  const files = [{ name: 'README.txt', content: readme(safe, generatedAt, present) }];
  const has = (key) => present.includes(key);

  if (has('html')) files.push({ name: 'case-report.html', content: buildCaseReportHtml(safe, { groupBy, generatedAt }) });
  if (has('markdown')) files.push({ name: 'case-report.md', content: buildCaseReport(safe, { groupBy }) });
  if (has('identifiersCsv')) files.push({ name: 'identifiers.csv', content: buildIdentifiersCsv(safe) });
  if (has('locationsCsv')) files.push({ name: 'locations.csv', content: buildLocationsCsv(safe) });
  if (has('evidenceCsv')) files.push({ name: 'evidence.csv', content: buildEvidenceCsv(safe) });

  if (has('dossiers')) {
    const used = new Set();
    for (const { item, index } of dossierItems) {
      let base = `${String(index + 1).padStart(2, '0')}-${safeFileName(item.title, 'identifier')}`
        .slice(0, 60)
        .replace(/_+$/, '');
      while (used.has(base)) base += '_';
      used.add(base);
      files.push({ name: `dossiers/${base}.md`, content: buildIdentifierDossier(safe, item.id) });
    }
  }

  if (has('views')) files.push({ name: 'saved-views.json', content: buildViewsExport(safe.filterPresets, generatedAt) });
  if (has('project')) files.push({ name: 'project.osint.json', content: JSON.stringify(safe, null, 2) });
  return files;
}

export function buildReportBundleZip(project, options = {}) {
  return createZip(buildReportBundleFiles(project, options), options.generatedAt ?? new Date());
}

// Which optional parts actually have content for this project.
export function availableBundleSections(project) {
  const safe = validateProject(project);
  const model = buildCaseReportModel(safe);
  return {
    dossiers: model.identifiers.filter((i) => i.evidenceIds.length > 0).length,
    views: (safe.filterPresets ?? []).length,
  };
}
