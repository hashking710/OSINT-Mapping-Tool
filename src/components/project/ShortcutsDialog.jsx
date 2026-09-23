const SHORTCUTS = [
  ['Ctrl/⌘ + S', 'Save project file'],
  ['/', 'Search identifiers or pins'],
  ['Alt + 1 / Alt + 2', 'Switch to Information / Map'],
  ['Ctrl/⌘ + Z / Y', 'Undo / redo (Information tab)'],
  ['Ctrl/⌘ + D', 'Duplicate selected nodes'],
  ['Delete', 'Remove selected nodes or edges'],
  ['?', 'Show this help'],
];

export default function ShortcutsDialog({ onClose, onReplayTour }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
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
          <button type="button" className="btn btn-ghost" onClick={onReplayTour}>Replay tour</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
