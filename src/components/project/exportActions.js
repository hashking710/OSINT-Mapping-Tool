import { downloadTextFile, printHtmlDocument } from '../../utils/download.js';

// Everything in the Export menu. The heavy report / CSV / view code is imported
// only when an item is used, so it stays out of the main bundle.
//
// run(project, base, { groupBy }, ui): `base` is the safe file-name stem and
// `ui` lets an item open one of the menu's dialogs.
export const EXPORT_ACTIONS = [
  {
    id: 'report',
    label: 'Case report (.md)',
    run: async (project, base, options) => {
      const { buildCaseReport } = await import('../../utils/caseReport.js');
      downloadTextFile(`${base}-case-report.md`, buildCaseReport(project, options), 'text/markdown');
    },
  },
  {
    id: 'report-html',
    label: 'Case report (.html)',
    run: async (project, base, options) => {
      const { buildCaseReportHtml } = await import('../../utils/caseReport.js');
      downloadTextFile(`${base}-case-report.html`, buildCaseReportHtml(project, options), 'text/html');
    },
  },
  {
    id: 'report-print',
    label: 'Print / save as PDF',
    run: async (project, base, options) => {
      const { buildCaseReportHtml } = await import('../../utils/caseReport.js');
      printHtmlDocument(buildCaseReportHtml(project, options));
    },
  },
  {
    id: 'bundle-zip',
    label: 'Report bundle (.zip)…',
    run: (project, base, options, ui) => ui.openBundle(),
  },
  {
    id: 'compare',
    label: 'Compare or merge with a file…',
    run: (project, base, options, ui) => ui.openCompare(),
  },
  {
    id: 'identifiers-csv',
    label: 'Identifiers (.csv)',
    run: async (project, base) => {
      const { buildIdentifiersCsv } = await import('../../utils/exportCsv.js');
      downloadTextFile(`${base}-identifiers.csv`, buildIdentifiersCsv(project), 'text/csv');
    },
  },
  {
    id: 'locations-csv',
    label: 'Locations (.csv)',
    run: async (project, base) => {
      const { buildLocationsCsv } = await import('../../utils/exportCsv.js');
      downloadTextFile(`${base}-locations.csv`, buildLocationsCsv(project), 'text/csv');
    },
  },
  {
    id: 'evidence-csv',
    label: 'Evidence (.csv)',
    run: async (project, base) => {
      const { buildEvidenceCsv } = await import('../../utils/exportCsv.js');
      downloadTextFile(`${base}-evidence.csv`, buildEvidenceCsv(project), 'text/csv');
    },
  },
  {
    id: 'views-json',
    label: 'Saved views (.json)',
    available: (project) => (project.filterPresets ?? []).length > 0,
    run: async (project, base) => {
      const { buildViewsExport } = await import('../../utils/viewsIO.js');
      downloadTextFile(`${base}-views.json`, buildViewsExport(project.filterPresets), 'application/json');
    },
  },
  {
    id: 'identifiers-json',
    label: 'Identifiers (.json)',
    run: (project, base) =>
      downloadTextFile(`${base}-identifiers.json`, JSON.stringify(project.identifiers ?? [], null, 2), 'application/json'),
  },
];
