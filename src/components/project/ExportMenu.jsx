import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { safeFileName } from '../../utils/download.js';
import { collectColors, collectTags } from '../../utils/identifierLabels.js';
import { EXPORT_ACTIONS } from './exportActions.js';

// The dialogs behind the menu are only downloaded the first time they are opened.
const BundleDialog = lazy(() => import('../BundleDialog.jsx'));
const CompareDialog = lazy(() => import('../CompareDialog.jsx'));

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export default function ExportMenu({ project, onMerge }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'bundle' | 'compare' | null
  const [groupBy, setGroupBy] = useState('none');
  const rootRef = useRef(null);

  const identifiers = project.identifiers ?? [];
  const hasLabels = collectTags(identifiers).length > 0 || collectColors(identifiers).length > 0;
  const effectiveGroupBy = hasLabels ? groupBy : 'none';

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

  const ui = { openBundle: () => setDialog('bundle'), openCompare: () => setDialog('compare') };
  const closeDialog = () => setDialog(null);

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
        <DownloadIcon />
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
          {EXPORT_ACTIONS.filter((item) => !item.available || item.available(project)).map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="export-menu-item"
              data-testid={`export-${item.id}`}
              onClick={() => {
                item.run(project, safeFileName(project.name), { groupBy: effectiveGroupBy }, ui);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        {dialog === 'bundle' && <BundleDialog project={project} groupBy={effectiveGroupBy} onClose={closeDialog} />}
        {dialog === 'compare' && <CompareDialog current={project} onMerge={onMerge} onClose={closeDialog} />}
      </Suspense>
    </div>
  );
}
