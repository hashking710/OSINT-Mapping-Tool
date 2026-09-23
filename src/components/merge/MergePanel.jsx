import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { mergeProjects, planMerge, resolveSelection } from '../../utils/projectMerge.js';

// The preview draws a graph (and soon a map), so it is fetched only when opened.
const MergePreview = lazy(() => import('../MergePreview.jsx'));

const ADD_GROUPS = [
  { category: 'identifiers', title: 'New identifiers' },
  { category: 'connections', title: 'New connections' },
  { category: 'locations', title: 'New locations' },
  { category: 'pinLinks', title: 'New pin links' },
  { category: 'evidence', title: 'New evidence' },
  { category: 'views', title: 'New saved views' },
];

const KIND_LABEL = { identifiers: 'identifier', connections: 'connection', locations: 'location' };

// New things are ticked by default; changed properties default to "keep mine".
const defaultSelection = (plan) => new Set(plan.filter((item) => item.kind === 'add').map((item) => item.key));

function GroupCheckbox({ checked, indeterminate, label, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" aria-label={label} checked={checked} onChange={onChange} />;
}

export default function MergePanel({ current, file, onMerge, submitLabel, backup }) {
  const plan = useMemo(() => planMerge(current, file.project), [current, file]);
  const [selected, setSelected] = useState(() => defaultSelection(plan));
  const [showPreview, setShowPreview] = useState(false);
  useEffect(() => setSelected(defaultSelection(plan)), [plan]);

  const effective = useMemo(() => resolveSelection(plan, selected), [plan, selected]);
  const preview = useMemo(() => mergeProjects(current, file.project, { keys: effective }), [current, file, effective]);
  const titleByKey = useMemo(() => new Map(plan.map((item) => [item.key, item.label])), [plan]);

  const setKeys = (keys, on) =>
    setSelected((currentSet) => {
      const next = new Set(currentSet);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  const groups = ADD_GROUPS.map((g) => ({ ...g, items: plan.filter((i) => i.kind === 'add' && i.category === g.category) })).filter(
    (g) => g.items.length > 0,
  );
  const updateItems = plan.filter((item) => item.kind === 'update');
  const updateGroups = useMemo(() => {
    const map = new Map();
    for (const item of updateItems) {
      if (!map.has(item.group.key)) map.set(item.group.key, { ...item.group, category: item.category, items: [] });
      map.get(item.group.key).items.push(item);
    }
    return [...map.values()];
  }, [updateItems]);

  return (
    <section className="merge-panel" data-testid="merge-panel">
      <h3>Merge into {current.name ? `“${current.name}”` : 'the open project'}</h3>
      <p className="merge-note">
        Choose exactly what to bring in. Nothing is ever deleted, and you can undo right after.
      </p>

      {plan.length === 0 && <p className="merge-note">The file has nothing new to add.</p>}

      {groups.map(({ category, title, items }) => {
        const chosen = items.filter((i) => effective.has(i.key)).length;
        return (
          <details key={category} className="merge-group" open data-testid={`merge-group-${category}`}>
            <summary>
              <label onClick={(e) => e.stopPropagation()}>
                <GroupCheckbox
                  label={`${title} (${items.length})`}
                  checked={chosen === items.length}
                  indeterminate={chosen > 0 && chosen < items.length}
                  onChange={(e) => setKeys(items.map((i) => i.key), e.target.checked)}
                />
                <span>{title}</span>
              </label>
              <span className="merge-count">
                {chosen} of {items.length}
              </span>
            </summary>
            <ul className="merge-items">
              {items.map((item) => {
                const blocked = item.needs.some((need) => !effective.has(need));
                return (
                  <li key={item.key}>
                    <label className={blocked ? 'disabled' : ''}>
                      <input
                        type="checkbox"
                        checked={effective.has(item.key)}
                        disabled={blocked}
                        onChange={(e) => setKeys([item.key], e.target.checked)}
                      />
                      <span>
                        {item.label}
                        {blocked && (
                          <span className="merge-needs">
                            {' '}needs {item.needs.filter((n) => !effective.has(n)).map((n) => titleByKey.get(n)).join(', ')}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      {updateGroups.length > 0 && (
        <details className="merge-group" open data-testid="merge-group-updates">
          <summary>
            <span className="merge-updates-title">Changed items you already have</span>
            <span className="merge-updates-actions">
              <button type="button" onClick={() => setKeys(updateItems.map((u) => u.key), false)}>Keep all mine</button>
              <button type="button" onClick={() => setKeys(updateItems.map((u) => u.key), true)}>Take all theirs</button>
            </span>
          </summary>
          <ul className="merge-items">
            {updateGroups.map((group) => (
              <li key={group.key} className="merge-update">
                <div className="merge-update-head">
                  <strong>{group.label}</strong>
                  <span className="merge-kind">{KIND_LABEL[group.category]}</span>
                  <span className="merge-update-actions">
                    <button type="button" aria-label={`Keep all mine for ${group.label}`} onClick={() => setKeys(group.items.map((i) => i.key), false)}>
                      Keep all mine
                    </button>
                    <button type="button" aria-label={`Take all theirs for ${group.label}`} onClick={() => setKeys(group.items.map((i) => i.key), true)}>
                      Take all theirs
                    </button>
                  </span>
                </div>
                <ul className="merge-fields">
                  {group.items.map((item) => (
                    <li key={item.key}>
                      <span className="merge-field-text">{item.text}</span>
                      <span className="merge-choice" role="radiogroup" aria-label={`Choice for ${group.label}: ${item.fieldLabel}`}>
                        <label>
                          <input type="radio" name={`choice-${item.key}`} checked={!selected.has(item.key)} onChange={() => setKeys([item.key], false)} />
                          Keep mine
                        </label>
                        <label>
                          <input type="radio" name={`choice-${item.key}`} checked={selected.has(item.key)} onChange={() => setKeys([item.key], true)} />
                          Take theirs
                        </label>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="merge-preview-toggle">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={showPreview}
          data-testid="merge-preview-toggle"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? 'Hide preview' : 'Preview result'}
        </button>
      </div>
      {showPreview && (
        <Suspense fallback={<p className="merge-note">Loading preview…</p>}>
          <MergePreview base={current} merged={preview.project} />
        </Suspense>
      )}

      {backup && (
        <label className="merge-backup">
          <input type="checkbox" checked={backup.value} onChange={(e) => backup.set(e.target.checked)} />
          Download a backup of &ldquo;{current.name}&rdquo; before merging
        </label>
      )}

      <button
        type="button"
        className="btn btn-primary"
        data-testid="merge-button"
        disabled={preview.total === 0}
        onClick={() => onMerge(preview.project, preview.summary)}
      >
        {preview.total === 0
          ? 'Nothing selected to merge'
          : `Merge ${preview.total} change${preview.total === 1 ? '' : 's'} ${submitLabel}`}
      </button>
    </section>
  );
}
