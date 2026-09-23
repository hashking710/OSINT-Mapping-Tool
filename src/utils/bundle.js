import { buildCaseReport, buildCaseReportHtml, buildIdentifierDossier, buildCaseReportModel } from './caseReport.js';
import { buildEvidenceCsv, buildIdentifiersCsv, buildLocationsCsv } from './exportCsv.js';
import { safeFileName } from './download.js';
import { validateProject } from './projectIO.js';
import { buildViewsExport } from './viewsIO.js';
import { createZip } from './zip.js';

function readme(project, generatedAt) {
  return [
    `${project.name} - report bundle`,
    `Generated ${generatedAt.toISOString().slice(0, 10)} by OSINT Mapping Tool.`,
    '',
    'This bundle is a read-only snapshot. Nothing in it phones home; open the files',
    'with any browser, text editor or spreadsheet.',
    '',
    'Contents',
    '  case-report.html     Styled report (print it to PDF from your browser)',
    '  case-report.md       The same report as Markdown',
    '  identifiers.csv      Identifiers with tags, colours and relationships',
    '  locations.csv        Pinned locations and who they are linked to',
    '  evidence.csv         Evidence timeline',
    '  dossiers/            One report per identifier that has related evidence',
    '  saved-views.json     Saved filter views (only if the project has any)',
    '  project.osint.json   The full project; open it in OSINT Mapping Tool to explore',
    '',
    'Verify every finding against primary sources before relying on it.',
    '',
  ].join('\n');
}

export function buildReportBundleFiles(project, { groupBy = 'none', generatedAt = new Date() } = {}) {
  const safe = validateProject(project);
  const files = [
    { name: 'README.txt', content: readme(safe, generatedAt) },
    { name: 'case-report.html', content: buildCaseReportHtml(safe, { groupBy, generatedAt }) },
    { name: 'case-report.md', content: buildCaseReport(safe, { groupBy }) },
    { name: 'identifiers.csv', content: buildIdentifiersCsv(safe) },
    { name: 'locations.csv', content: buildLocationsCsv(safe) },
    { name: 'evidence.csv', content: buildEvidenceCsv(safe) },
  ];

  const used = new Set();
  buildCaseReportModel(safe).identifiers.forEach((item, index) => {
    if (item.evidenceIds.length === 0) return;
    let base = `${String(index + 1).padStart(2, '0')}-${safeFileName(item.title, 'identifier')}`
      .slice(0, 60)
      .replace(/_+$/, '');
    while (used.has(base)) base += '_';
    used.add(base);
    files.push({ name: `dossiers/${base}.md`, content: buildIdentifierDossier(safe, item.id) });
  });

  if ((safe.filterPresets ?? []).length > 0) {
    files.push({ name: 'saved-views.json', content: buildViewsExport(safe.filterPresets, generatedAt) });
  }
  files.push({ name: 'project.osint.json', content: JSON.stringify(safe, null, 2) });
  return files;
}

export function buildReportBundleZip(project, options = {}) {
  return createZip(buildReportBundleFiles(project, options), options.generatedAt ?? new Date());
}
