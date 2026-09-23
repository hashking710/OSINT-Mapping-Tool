import { getPinColor } from '../../pinColors.js';

// Colour dots and tag chips that filter the sidebar list (and dim canvas nodes).
export default function LabelFilterBar({ tags, colors, active, setFilter, groupByTag, onToggleGroup }) {
  if (tags.length === 0 && colors.length === 0) return null;
  return (
    <div className="label-filter" role="group" aria-label="Filter by label">
      {colors.map((color) => {
        const { bg, border, name } = getPinColor(color);
        return (
          <button
            key={color}
            type="button"
            className={`label-filter-dot ${active.color === color ? 'active' : ''}`}
            style={{ background: bg, borderColor: border }}
            aria-pressed={active.color === color}
            aria-label={`Filter by colour ${name}`}
            onClick={() => setFilter((f) => ({ ...f, color: f.color === color ? null : color }))}
          />
        );
      })}
      {tags.slice(0, 10).map(({ tag, count }) => {
        const on = active.tag?.toLowerCase() === tag.toLowerCase();
        return (
          <button
            key={tag}
            type="button"
            className={`tag-chip filterable ${on ? 'active' : ''}`}
            aria-pressed={on}
            onClick={() => setFilter((f) => ({ ...f, tag: on ? null : tag }))}
          >
            {tag} <span className="tag-count">{count}</span>
          </button>
        );
      })}
      {(active.tag || active.color) && (
        <button type="button" className="label-filter-clear" onClick={() => setFilter({ tag: null, color: null })}>
          Clear
        </button>
      )}
      {tags.length > 0 && (
        <button
          type="button"
          className={`label-filter-group ${groupByTag ? 'active' : ''}`}
          aria-pressed={groupByTag}
          onClick={onToggleGroup}
        >
          Group by tag
        </button>
      )}
    </div>
  );
}
