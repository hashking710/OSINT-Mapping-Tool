import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { NavigationProvider, useNavigation } from '../context/NavigationContext.jsx';
import { NodeHistoryProvider } from '../context/NodeHistoryContext.jsx';
import { buildCaseReport, buildCaseReportHtml } from '../utils/caseReport.js';
import { buildEvidenceCsv, buildIdentifiersCsv, buildLocationsCsv } from '../utils/exportCsv.js';
import { downloadTextFile, printHtmlDocument, safeFileName } from '../utils/download.js';
import { describeMergeSummary } from '../utils/projectMerge.js';
import BundleDialog from './BundleDialog.jsx';
import CompareDialog from './CompareDialog.jsx';
import { collectColors, collectTags } from '../utils/identifierLabels.js';
import { buildViewsExport } from '../utils/viewsIO.js';
import ThemeToggle from './ThemeToggle.jsx';
import Tour, { hasSeenTour } from './Tour.jsx';
import './ProjectView.css';

const SHORTCUTS = [
  ['Ctrl/⌘ + S', 'Save project file'],
  ['/', 'Search identifiers or pins'],
  ['Alt + 1 / Alt + 2', 'Switch to Information / Map'],
  ['Ctrl/⌘ + Z / Y', 'Undo / redo (Information tab)'],
  ['Ctrl/⌘ + D', 'Duplicate selected nodes'],
  ['Delete', 'Remove selected nodes or edges'],
  ['?', 'Show this help'],
];

const isTypingTarget = (el) =>
  !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

const InfoTab = lazy(() => import('./InfoTab.jsx'));
const MapTab = lazy(() => import('./MapTab.jsx'));

function ProjectLoading() {
  return <div className="project-loading">Loading project workspace…</div>;
}

export default function ProjectView() {
  return (
    <NavigationProvider>
      <NodeHistoryProvider>
        <ProjectViewInner />
      </NodeHistoryProvider>
    </NavigationProvider>
  );
}

const EXPORTS = [
  {
    id: 'report',
    label: 'Case report (.md)',
    run: (project, base, options) =>
      downloadTextFile(`${base}-case-report.md`, buildCaseReport(project, options), 'text/markdown'),
  },
  {
    id: 'report-html',
    label: 'Case report (.html)',
    run: (project, base, options) =>
      downloadTextFile(`${base}-case-report.html`, buildCaseReportHtml(project, options), 'text/html'),
  },
  {
    id: 'report-print',
    label: 'Print / save as PDF',
    run: (project, base, options) => printHtmlDocument(buildCaseReportHtml(project, options)),
  },
  {
    id: 'bundle-zip',
    label: 'Report bundle (.zip)\u2026',
    run: (project, base, options, actions) => actions.openBundle(),
  },
  {
    id: 'compare',
    label: 'Compare or merge with a file\u2026',
    run: (project, base, options, actions) => actions.openCompare(),
  },
  {
    id: 'identifiers-csv',
    label: 'Identifiers (.csv)',
    run: (project, base) =>
      downloadTextFile(`${base}-identifiers.csv`, buildIdentifiersCsv(project), 'text/csv'),
  },
  {
    id: 'locations-csv',
    label: 'Locations (.csv)',
    run: (project, base) =>
      downloadTextFile(`${base}-locations.csv`, buildLocationsCsv(project), 'text/csv'),
  },
  {
    id: 'evidence-csv',
    label: 'Evidence (.csv)',
    run: (project, base) =>
      downloadTextFile(`${base}-evidence.csv`, buildEvidenceCsv(project), 'text/csv'),
  },
  {
    id: 'views-json',
    label: 'Saved views (.json)',
    available: (project) => (project.filterPresets ?? []).length > 0,
    run: (project, base) =>
      downloadTextFile(`${base}-views.json`, buildViewsExport(project.filterPresets), 'application/json'),
  },
  {
    id: 'identifiers-json',
    label: 'Identifiers (.json)',
    run: (project, base) =>
      downloadTextFile(
        `${base}-identifiers.json`,
        JSON.stringify(project.identifiers ?? [], null, 2),
        'application/json',
      ),
  },
];

function ExportMenu({ project, onMerge }) {
  const [open, setOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [groupBy, setGroupBy] = useState('none');
  const [bundleOpen, setBundleOpen] = useState(false);
  const hasLabels =
    collectTags(project.identifiers ?? []).length > 0 || collectColors(project.identifiers ?? []).length > 0;
  const effectiveGroupBy = hasLabels ? groupBy : 'none';
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn-secondary"
        data-testid="export-case-report-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export"
        title="Export report or data"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        <span className="btn-label">Export</span>
      </button>
      {open && (
        <div className="export-menu-list" role="menu">
          {hasLabels && (
            <label className="export-group">
              Group reports by
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} aria-label="Group reports by">
                <option value="none">Nothing</option>
                <option value="tag">Tag</option>
                <option value="colour">Colour label</option>
              </select>
            </label>
          )}
          {EXPORTS.filter((item) => !item.available || item.available(project)).map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="export-menu-item"
              data-testid={`export-${item.id}`}
              onClick={() => {
                item.run(project, safeFileName(project.name), { groupBy: effectiveGroupBy }, { openBundle: () => setBundleOpen(true), openCompare: () => setCompareOpen(true) });
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {bundleOpen && (
        <BundleDialog project={project} groupBy={effectiveGroupBy} onClose={() => setBundleOpen(false)} />
      )}
      {compareOpen && (
        <CompareDialog current={project} onMerge={onMerge} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}

function ProjectViewInner() {
  const { project, isDirty, saveProject, closeProject, updateProject } = useProject();
  const [mergeUndo, setMergeUndo] = useState(null);
  const { tab, setTab } = useNavigation();
  const [showHelp, setShowHelp] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour());

  useEffect(() => {
    if (tourOpen) setTab('info');
  }, [tourOpen, setTab]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveProject();
        return;
      }
      if (event.key === 'Escape') {
        setShowHelp(false);
        return;
      }
      if (event.altKey && (event.key === '1' || event.key === '2')) {
        event.preventDefault();
        setTab(event.key === '1' ? 'info' : 'map');
        return;
      }
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '/') {
        const pane = document.getElementById(tab === 'info' ? 'info-panel' : 'map-panel');
        const input = pane?.querySelector('.identifier-search, .map-search-input');
        if (input) {
          event.preventDefault();
          // On phones the sidebar may be collapsed; expand it so the input is focusable.
          if (input.offsetParent === null) pane.querySelector('.sidebar-toggle')?.click();
          window.setTimeout(() => input.focus(), 0);
        }
      } else if (event.key === '?') {
        event.preventDefault();
        setShowHelp((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveProject, setTab, tab]);
  const handleTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    setTab(event.key === 'ArrowRight' ? 'map' : 'info');
  };

  const handleMerge = (merged, summary) => {
    setMergeUndo({ snapshot: project, summary, stamp: null });
    updateProject(merged);
  };

  // The undo offer only lasts until the next edit, so it can never wipe out
  // work done after the merge.
  useEffect(() => {
    if (!mergeUndo || !project) return;
    if (mergeUndo.stamp === null) {
      if (project.updatedAt !== mergeUndo.snapshot.updatedAt) setMergeUndo({ ...mergeUndo, stamp: project.updatedAt });
    } else if (project.updatedAt !== mergeUndo.stamp) {
      setMergeUndo(null);
    }
  }, [project, mergeUndo]);

  const undoMerge = () => {
    if (!mergeUndo) return;
    updateProject(mergeUndo.snapshot);
    setMergeUndo(null);
  };

  return (
    <div className="project-view">
      <header className="project-topbar">
        <div className="topbar-left">
          <button
            className="icon-btn"
            data-testid="back-to-projects-button"
            onClick={closeProject}
            title="Back to projects"
            aria-label="Back to projects"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="project-title">
            <div className="project-name">{project.name}</div>
            {project.target?.name && (
              <div className="project-target">Target: {project.target.name}</div>
            )}
          </div>
        </div>

        <nav className="tab-switcher" role="tablist">
          <button
            id="info-tab"
            role="tab"
            aria-selected={tab === 'info'}
            aria-controls="info-panel"
            tabIndex={tab === 'info' ? 0 : -1}
            className={`tab-button ${tab === 'info' ? 'active' : ''}`}
            onClick={() => setTab('info')}
            onKeyDown={handleTabKeyDown}
          >
            Information
          </button>
          <button
            id="map-tab"
            role="tab"
            aria-selected={tab === 'map'}
            aria-controls="map-panel"
            tabIndex={tab === 'map' ? 0 : -1}
            className={`tab-button ${tab === 'map' ? 'active' : ''}`}
            onClick={() => setTab('map')}
            onKeyDown={handleTabKeyDown}
          >
            Map
          </button>
        </nav>

        <div className="topbar-right">
          <ExportMenu project={project} onMerge={handleMerge} />
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="save-project-button"
            onClick={saveProject}
            aria-label="Save"
            title={isDirty ? 'Save project file (unsaved changes)' : 'Save project file'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <path d="M17 21v-8H7v8M7 3v5h8" />
            </svg>
            <span className="btn-label">Save</span>
            {isDirty && <span className="unsaved-dot" data-testid="unsaved-indicator" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="icon-btn shortcuts-btn"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={() => setShowHelp(true)}
          >
            ?
          </button>
          <ThemeToggle />
        </div>
      </header>

      {mergeUndo && (
        <div className="merge-banner" role="status" data-testid="merge-banner">
          <span>Merged from file: {describeMergeSummary(mergeUndo.summary)}</span>
          <button type="button" onClick={undoMerge}>Undo</button>
          <button type="button" aria-label="Dismiss" onClick={() => setMergeUndo(null)}>&times;</button>
        </div>
      )}

      {tourOpen && <Tour onClose={() => setTourOpen(false)} />}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <dl className="shortcut-list">
              {SHORTCUTS.map(([keys, action]) => (
                <div key={keys} className="shortcut-row">
                  <dt><kbd>{keys}</kbd></dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowHelp(false);
                  setTourOpen(true);
                }}
              >
                Replay tour
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowHelp(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={<ProjectLoading />}>
        <main className="project-main">
          {/* Keep BOTH panes mounted and toggle visibility with CSS so each
              tab preserves its internal state across switches — most
              importantly the Leaflet/Google map viewport. */}
          <div
            id="info-panel"
            className="tab-pane"
            role="tabpanel"
            aria-labelledby="info-tab"
            aria-hidden={tab !== 'info'}
            hidden={tab !== 'info'}
          >
            <InfoTab />
          </div>
          <div
            id="map-panel"
            className="tab-pane"
            role="tabpanel"
            aria-labelledby="map-tab"
            aria-hidden={tab !== 'map'}
            hidden={tab !== 'map'}
          >
            <MapTab visible={tab === 'map'} />
          </div>
        </main>
      </Suspense>
    </div>
  );
}
