import { lazy, Suspense, useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { NavigationProvider, useNavigation } from '../context/NavigationContext.jsx';
import { NodeHistoryProvider } from '../context/NodeHistoryContext.jsx';
import { buildCaseReport } from '../utils/projectIO.js';
import ThemeToggle from './ThemeToggle.jsx';
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

function ProjectViewInner() {
  const { project, isDirty, saveProject, closeProject } = useProject();
  const { tab, setTab } = useNavigation();
  const [showHelp, setShowHelp] = useState(false);

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
          input.focus();
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

  const handleExportCaseReport = () => {
    const report = buildCaseReport(project);
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (project.name || 'project')
      .replace(/[^a-z0-9-_]+/gi, '_')
      .toLowerCase();
    link.href = url;
    link.download = `${safeName}-case-report.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="export-case-report-button"
            onClick={handleExportCaseReport}
            aria-label="Export report"
            title="Export report"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span className="btn-label">Export report</span>
          </button>
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
