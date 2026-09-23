// Saved views: named combinations of search text, tag and colour.
export default function PresetBar({
  presets,
  filtersActive,
  isActive,
  onApply,
  onRemove,
  draft,
  setDraft,
  onSave,
}) {
  if (presets.length === 0 && !filtersActive) return null;
  return (
    <div className="preset-bar" role="group" aria-label="Saved views">
      {presets.map((preset) => (
        <span key={preset.id} className={`preset-chip ${isActive(preset) ? 'active' : ''}`}>
          <button type="button" onClick={() => onApply(preset)} title="Apply this saved view">
            {preset.name}
          </button>
          <button
            type="button"
            className="preset-remove"
            aria-label={`Delete view ${preset.name}`}
            onClick={() => onRemove(preset.id)}
          >
            &times;
          </button>
        </span>
      ))}
      {filtersActive && draft === null && (
        <button type="button" className="preset-save" onClick={() => setDraft('')}>
          Save view
        </button>
      )}
      {draft !== null && (
        <form className="preset-form" onSubmit={onSave}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="View name"
            aria-label="View name"
            maxLength={40}
          />
          <button type="submit" disabled={!draft.trim()}>Save</button>
          <button type="button" onClick={() => setDraft(null)}>Cancel</button>
        </form>
      )}
    </div>
  );
}
