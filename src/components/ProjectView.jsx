import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { NavigationProvider, useNavigation } from '../context/NavigationContext.jsx';
import { NodeHistoryProvider } from '../context/NodeHistoryContext.jsx';
import { useProjectShortcuts } from '../hooks/useProjectShortcuts.js';
import { hasSeenTour } from '../utils/tourState.js';
import MergeBanner from './project/MergeBanner.jsx';
import ProjectTopBar from './project/ProjectTopBar.jsx';
import ShortcutsDialog from './project/ShortcutsDialog.jsx';
import './ProjectView.css';

// Each tab (and the first-run tour) is downloaded when it is first needed.
const InfoTab = lazy(() => import('./InfoTab.jsx'));
const MapTab = lazy(() => import('./MapTab.jsx'));
const Tour = lazy(() => import('./Tour.jsx'));

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
  const { project, isDirty, saveProject, closeProject, mergeUndo, applyMerge, undoMerge, dismissMergeUndo } =
    useProject();
  const { tab, setTab } = useNavigation();
  const [showHelp, setShowHelp] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour());

  useEffect(() => {
    if (tourOpen) setTab('info');
  }, [tourOpen, setTab]);

  const toggleHelp = useCallback(() => setShowHelp((open) => !open), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);
  useProjectShortcuts({ tab, setTab, saveProject, toggleHelp, closeHelp });

  return (
    <div className="project-view">
      <ProjectTopBar
        project={project}
        tab={tab}
        setTab={setTab}
        isDirty={isDirty}
        onSave={saveProject}
        onClose={closeProject}
        onMerge={applyMerge}
        onShowHelp={() => setShowHelp(true)}
      />

      <MergeBanner mergeUndo={mergeUndo} onUndo={undoMerge} onDismiss={dismissMergeUndo} />

      <Suspense fallback={null}>{tourOpen && <Tour onClose={() => setTourOpen(false)} />}</Suspense>

      {showHelp && (
        <ShortcutsDialog
          onClose={closeHelp}
          onReplayTour={() => {
            setShowHelp(false);
            setTourOpen(true);
          }}
        />
      )}

      <Suspense fallback={<ProjectLoading />}>
        <main className="project-main">
          {/* Keep BOTH panes mounted and toggle visibility with CSS so each tab
              preserves its internal state across switches: most importantly the
              Leaflet/Google map viewport. */}
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
