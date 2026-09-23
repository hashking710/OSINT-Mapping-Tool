const SUGGESTIONS = [
  'associate of',
  'family member of',
  'works for',
  'owns',
  'employs',
  'lives at',
  'communicates with',
  'linked account of',
  'same person as',
];

// Describe how two identifiers are related (double-click a line to open).
export default function EdgeLabelDialog({ edit, onChange, onCancel, onSubmit }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal edge-label-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edge-label-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <h2 id="edge-label-title">Relationship</h2>
        <p className="modal-sub">Describe how these two identifiers are related.</p>
        <div className="field">
          <label htmlFor="edge-label-input">Label</label>
          <input
            id="edge-label-input"
            autoFocus
            list="edge-label-suggestions"
            value={edit.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. associate of"
            maxLength={60}
          />
          <datalist id="edge-label-suggestions">
            {SUGGESTIONS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save label</button>
        </div>
      </form>
    </div>
  );
}
