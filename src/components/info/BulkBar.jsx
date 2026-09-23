import { getPinColor } from '../../pinColors.js';
import { LABEL_COLORS, addTags, removeTags } from '../../utils/identifierLabels.js';

// Toolbar shown in select mode, with an expandable tag/colour panel.
export default function BulkBar({ bulk, filtersActive }) {
  const { selection, tagDraft, setTagDraft, applyLabels } = bulk;
  const none = selection.length === 0;
  const tag = tagDraft.trim();

  const changeTag = (change) => {
    applyLabels((identifier) => ({ tags: change(identifier.tags, tagDraft) }));
    setTagDraft('');
  };

  return (
    <>
      <div className="bulk-bar" role="toolbar" aria-label="Bulk actions">
        <span className="bulk-count" data-testid="bulk-count">{selection.length} selected</span>
        <button type="button" onClick={bulk.selectAllShown}>
          All{filtersActive ? ' shown' : ''}
        </button>
        <button type="button" aria-expanded={bulk.labelOpen} onClick={bulk.toggleLabelOpen} disabled={none}>
          Label
        </button>
        <button type="button" onClick={bulk.duplicateSelected} disabled={none}>Duplicate</button>
        <button type="button" className="danger" onClick={bulk.deleteSelected} disabled={none}>Delete</button>
      </div>

      {bulk.labelOpen && (
        <div className="bulk-label-panel" data-testid="bulk-label-panel">
          <div className="bulk-label-row">
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="Tag name"
              aria-label="Tag name"
              maxLength={30}
            />
            <button type="button" disabled={!tag || none} onClick={() => changeTag(addTags)}>Add tag</button>
            <button type="button" disabled={!tag || none} onClick={() => changeTag(removeTags)}>Remove</button>
          </div>
          <div className="bulk-label-row label-swatches" role="group" aria-label="Set colour for selection">
            <button
              type="button"
              className="label-swatch none"
              aria-label="Clear colour for selection"
              onClick={() => applyLabels(() => ({ color: null }))}
            >
              &times;
            </button>
            {LABEL_COLORS.map((color) => {
              const { bg, border, name } = getPinColor(color);
              return (
                <button
                  key={color}
                  type="button"
                  className="label-swatch"
                  style={{ background: bg, borderColor: border }}
                  aria-label={`Set colour ${name} for selection`}
                  onClick={() => applyLabels(() => ({ color }))}
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
