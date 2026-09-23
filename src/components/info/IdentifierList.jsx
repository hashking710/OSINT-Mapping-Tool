import { groupItemsByTag } from '../../utils/identifierLabels.js';

// The sidebar list: empty states, or a flat / grouped-by-tag list of rows.
// `renderRow(identifier, keyPrefix)` supplies each row.
export default function IdentifierList({
  totalCount,
  identifiers,
  groupByTag,
  collapsedGroups,
  onToggleGroup,
  selectMode,
  renderRow,
}) {
  if (totalCount === 0) {
    return (
      <div className="empty-state">
        <p>No identifiers yet.</p>
        <p className="empty-hint">
          Add social profiles, phones, emails, names, vehicles, and custom fields here.
        </p>
      </div>
    );
  }
  if (identifiers.length === 0) {
    return (
      <div className="empty-state">
        <p>No matches found.</p>
        <p className="empty-hint">Try a different name, email, phone, alias, or note.</p>
      </div>
    );
  }

  const listClass = `identifier-list ${selectMode ? 'select-mode' : ''}`;
  if (!groupByTag) {
    return <ul className={listClass}>{identifiers.map((identifier) => renderRow(identifier))}</ul>;
  }

  return (
    <div className="identifier-groups">
      {groupItemsByTag(identifiers).map((group) => {
        const collapsed = collapsedGroups.has(group.name);
        return (
          <div key={group.name} className="identifier-group">
            <button
              type="button"
              className="identifier-group-header"
              aria-expanded={!collapsed}
              onClick={() => onToggleGroup(group.name)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              <span className="identifier-group-name">{group.name}</span>
              <span className="tag-count">{group.items.length}</span>
            </button>
            {!collapsed && (
              <ul className={listClass}>{group.items.map((identifier) => renderRow(identifier, `${group.name}:`))}</ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
