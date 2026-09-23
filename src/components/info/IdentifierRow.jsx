import { getDisplayLabel, getSecondaryLabel, getTypeDef } from '../../identifierTypes.js';
import { getPinColor } from '../../pinColors.js';
import IdentifierBadge from '../IdentifierBadge.jsx';

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

export default function IdentifierRow({
  identifier,
  focused,
  selected,
  selectMode,
  evidenceCount,
  registerRow,
  onOpen,
  onToggleSelected,
  onDelete,
  onShowEvidence,
  onHover,
}) {
  const def = getTypeDef(identifier.type);
  const display = getDisplayLabel(identifier);
  const secondary = getSecondaryLabel(identifier);
  const tags = identifier.tags ?? [];

  return (
    <li
      ref={(el) => registerRow(identifier.id, el)}
      className={`identifier-item ${focused ? 'focused' : ''} ${selected ? 'selected' : ''}`}
      style={identifier.color ? { boxShadow: `inset 4px 0 0 ${getPinColor(identifier.color).bg}` } : undefined}
      onClick={() => (selectMode ? onToggleSelected(identifier.id) : onOpen(identifier))}
      onMouseEnter={() => onHover(identifier.id)}
      onMouseLeave={() => onHover(null)}
    >
      {selectMode && (
        <input type="checkbox" className="identifier-check" checked={selected} readOnly aria-label={`Select ${display}`} />
      )}
      <IdentifierBadge typeKey={identifier.type} customIconId={identifier.customIconId} size="md" />
      <div className="identifier-body">
        <div className="identifier-type">{def.label}</div>
        <div className="identifier-label">{display}</div>
        {secondary && <div className="identifier-secondary">{secondary}</div>}
        {tags.length > 0 && (
          <div className="identifier-tags">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag-chip">{tag}</span>
            ))}
            {tags.length > 3 && <span className="tag-chip more">+{tags.length - 3}</span>}
          </div>
        )}
      </div>
      {evidenceCount > 0 && (
        <button
          type="button"
          className="evidence-chip"
          title="Show evidence linked to this identifier"
          onClick={(e) => {
            e.stopPropagation();
            onShowEvidence(identifier);
          }}
        >
          {evidenceCount} evidence
        </button>
      )}
      <button
        type="button"
        className="identifier-delete"
        onClick={(e) => onDelete(e, identifier.id, display)}
        aria-label={`Delete ${display}`}
        title="Delete"
      >
        <TrashIcon />
      </button>
    </li>
  );
}
