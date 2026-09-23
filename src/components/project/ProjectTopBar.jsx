import ThemeToggle from '../ThemeToggle.jsx';
import ExportMenu from './ExportMenu.jsx';

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
);

const TABS = [
  { id: 'info', label: 'Information' },
  { id: 'map', label: 'Map' },
];

export default function ProjectTopBar({ project, tab, setTab, isDirty, onSave, onClose, onMerge, onShowHelp }) {
  const onTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    setTab(event.key === 'ArrowRight' ? 'map' : 'info');
  };

  return (
    <header className="project-topbar">
      <div className="topbar-left">
        <button
          className="icon-btn"
          data-testid="back-to-projects-button"
          onClick={onClose}
          title="Back to projects"
          aria-label="Back to projects"
        >
          <BackIcon />
        </button>
        <div className="project-title">
          <div className="project-name">{project.name}</div>
          {project.target?.name && <div className="project-target">Target: {project.target.name}</div>}
        </div>
      </div>

      <nav className="tab-switcher" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            id={`${id}-tab`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`${id}-panel`}
            tabIndex={tab === id ? 0 : -1}
            className={`tab-button ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
            onKeyDown={onTabKeyDown}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        <ExportMenu project={project} onMerge={onMerge} />
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="save-project-button"
          onClick={onSave}
          aria-label="Save"
          title={isDirty ? 'Save project file (unsaved changes)' : 'Save project file'}
        >
          <SaveIcon />
          <span className="btn-label">Save</span>
          {isDirty && <span className="unsaved-dot" data-testid="unsaved-indicator" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="icon-btn shortcuts-btn"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          onClick={onShowHelp}
        >
          ?
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
