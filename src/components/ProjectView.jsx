import { lazy, Suspense } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { NavigationProvider, useNavigation } from '../context/NavigationContext.jsx';
import { NodeHistoryProvider } from '../context/NodeHistoryContext.jsx';
import { buildCaseReport } from '../utils/projectIO.js';
import ThemeToggle from './ThemeToggle.jsx';
import './ProjectView.css';

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
  const { project, saveProject, closeProject } = useProject();
  const { tab, setTab } = useNavigation();
  const handleTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    setTab(event.key === 'ArrowRight' ? 'map' : 'info');
  };

  const handleExportCaseReport = () => {
    const report = buildCaseReport(project);
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (project.name || 'project')
      .replace(/[^a-z0-9-_]+/gi, '_')
      .toLowerCase();
    link.href = url;
    link.download = `${safeName}-case-report.txt`;
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
          >
            Export report
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="save-project-button"
            onClick={saveProject}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <path d="M17 21v-8H7v8M7 3v5h8" />
            </svg>
            Save
          </button>
          <ThemeToggle />
        </div>
      </header>

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
