import { useEffect, useMemo, useRef, useState } from 'react';
import { readProjectFromFile, validateProject } from '../utils/projectIO.js';
import { buildDiffMarkdown, diffProjects } from '../utils/projectDiff.js';
import { combineProjects, mergeProjects, planMerge, resolveSelection } from '../utils/projectMerge.js';
import { downloadTextFile, safeFileName } from '../utils/download.js';
import MergePreview from './MergePreview.jsx';
import './CompareDialog.css';

const SECTIONS = [
  { key: 'identifiers', title: 'Identifiers' },
  { key: 'connections', title: 'Connections' },
  { key: 'locations', title: 'Locations' },
  { key: 'pinLinks', title: 'Pin links' },
  { key: 'evidence', title: 'Evidence' },
];

const ADD_GROUPS = [
  { category: 'identifiers', title: 'New identifiers' },
  { category: 'connections', title: 'New connections' },
  { category: 'locations', title: 'New locations' },
  { category: 'pinLinks', title: 'New pin links' },
  { category: 'evidence', title: 'New evidence' },
  { category: 'views', title: 'New saved views' },
];

const KIND_LABEL = { identifiers: 'identifier', connections: 'connection', locations: 'location' };
const BACKUP_KEY = 'osint-tool:merge-backup';

const evidenceText = (e) => `${e.date} ${e.title} (${e.source})`;
const formatWhen = (iso) => (typeof iso === 'string' ? iso.slice(0, 16).replace('T', ' ') : '');

function FilePicker({ label, slot, testId, onFile }) {
  const inputRef = useRef(null);
  return (
    <div className="compare-slot">
      <div className="compare-slot-label">{label}</div>
      <div className="compare-slot-file">
        {slot ? (
          <>
            <strong>{slot.project.name}</strong>
            <span>{slot.fileName}</span>
          </>
        ) : (
          <span className="compare-slot-empty">No file chosen</span>
        )}
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
        {slot ? 'Change file' : 'Choose file'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json,application/zip,.zip"
        data-testid={testId}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

// One or more files to merge from, kept in order.
function SourceList({ label, sources, testId, onFiles, onRemove, onMove }) {
  const inputRef = useRef(null);
  return (
    <div className="compare-slot" data-testid="merge-sources">
      <div className="compare-slot-label">{label}</div>
      {sources.length === 0 ? (
        <div className="compare-slot-file">
          <span className="compare-slot-empty">No file chosen</span>
        </div>
      ) : (
        <ol className="source-list">
          {sources.map((source, index) => (
            <li key={`${source.fileName}-${index}`}>
              <span className="source-name">
                <strong>{source.project.name}</strong>
                <span>{source.fileName}</span>
              </span>
              {sources.length > 1 && (
                <span className="source-actions">
                  <button type="button" aria-label={`Move ${source.fileName} up`} disabled={index === 0} onClick={() => onMove(index, -1)}>
                    &uarr;
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${source.fileName} down`}
                    disabled={index === sources.length - 1}
                    onClick={() => onMove(index, 1)}
                  >
                    &darr;
                  </button>
                </span>
              )}
              <button type="button" className="source-remove" aria-label={`Remove ${source.fileName}`} onClick={() => onRemove(index)}>
                &times;
              </button>
            </li>
          ))}
        </ol>
      )}
      {sources.length > 1 && (
        <p className="source-hint">Combined in this order. Where files disagree, the later file wins.</p>
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
        {sources.length === 0 ? 'Choose files' : 'Add another file'}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/json,.json,application/zip,.zip"
        data-testid={testId}
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}

// Choose which project a file is merged into: one of the recent projects, or a file.
function BasePicker({ recents, slot, onRecent, onFile }) {
  const inputRef = useRef(null);
  const value = slot?.recentId ?? '';
  return (
    <div className="compare-slot" data-testid="merge-base">
      <div className="compare-slot-label">Project to merge into</div>
      <div className="compare-slot-file">
        {slot ? (
          <>
            <strong>{slot.project.name}</strong>
            <span>{slot.fileName}</span>
          </>
        ) : (
          <span className="compare-slot-empty">Nothing chosen</span>
        )}
      </div>
      {recents.length > 0 && (
        <select
          className="compare-base-select"
          aria-label="Project to merge into"
          value={value}
          onChange={(e) => {
            const entry = recents.find((r) => r.id === e.target.value);
            if (entry) onRecent(entry);
          }}
        >
          {!value && <option value="">Pick a recent project</option>}
          {recents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
        Choose a file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json,application/zip,.zip"
        data-testid="merge-base-file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

function SectionDetails({ sectionKey, title, diff }) {
  const counts = diff.summary[sectionKey];
  if (counts.added + counts.removed + counts.changed === 0) return null;
  const data = diff[sectionKey];
  const render = sectionKey === 'evidence' ? evidenceText : (x) => x;
  return (
    <section className="compare-section" data-testid={`compare-${sectionKey}`}>
      <h3>
        {title}
        <span className="compare-counts">
          {counts.added > 0 && <span className="added">+{counts.added}</span>}
          {counts.removed > 0 && <span className="removed">&minus;{counts.removed}</span>}
          {counts.changed > 0 && <span className="changed">~{counts.changed}</span>}
        </span>
      </h3>
      <ul>
        {(data.added ?? []).map((item, i) => (
          <li key={`a${i}`} className="added">{render(item)}</li>
        ))}
        {(data.removed ?? []).map((item, i) => (
          <li key={`r${i}`} className="removed">{render(item)}</li>
        ))}
        {(data.changed ?? []).map((item, i) => (
          <li key={`c${i}`} className="changed">
            {typeof item === 'string' ? (
              item
            ) : (
              <>
                <strong>{item.title}</strong>
                <ul className="compare-changes">
                  {item.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// New things are ticked by default; changed properties default to "keep mine".
const defaultSelection = (plan) => new Set(plan.filter((item) => item.kind === 'add').map((item) => item.key));

function GroupCheckbox({ checked, indeterminate, label, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" aria-label={label} checked={checked} onChange={onChange} />;
}

function MergePanel({ current, file, onMerge, submitLabel, backup }) {
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
      {showPreview && <MergePreview base={current} merged={preview.project} />}

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

function MergeHistory({ entries }) {
  if (!entries || entries.length === 0) return null;
  return (
    <details className="merge-history" data-testid="merge-history">
      <summary>Merge history ({entries.length})</summary>
      <ul>
        {[...entries].reverse().map((entry) => (
          <li key={entry.id}>
            <span className="merge-history-when">{formatWhen(entry.at)}</span>
            <span>
              {entry.source ? `From ${entry.source}: ` : ''}
              {entry.text}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Three ways to use it:
//  - standalone: compare two files
//  - `current` (the open project): compare it with one or more files and merge them in
//  - `startMerge` with `recents`: pick a project and files, merge, then open the result
export default function CompareDialog({ onClose, current = null, onMerge = null, startMerge = false, recents = [] }) {
  const [beforeSlot, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [sources, setSources] = useState([]);
  const [baseSlot, setBaseSlot] = useState(null);
  // 'toFile': my project -> the file, so green means "what the file adds" (what a merge brings in).
  const [direction, setDirection] = useState('toFile');
  const [error, setError] = useState('');
  const [backup, setBackup] = useState(() => {
    try {
      return window.localStorage.getItem(BACKUP_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const inProject = !!current || startMerge;

  const changeBackup = (value) => {
    setBackup(value);
    try {
      window.localStorage.setItem(BACKUP_KEY, value ? 'on' : 'off');
    } catch {
      /* the preference just is not remembered */
    }
  };

  const recentSlot = (entry) => ({
    recentId: entry.id,
    fileName: 'Recent project on this device',
    project: validateProject(entry.snapshot),
  });
  useEffect(() => {
    if (startMerge && recents.length > 0 && !baseSlot) {
      try {
        setBaseSlot(recentSlot(recents[0]));
      } catch {
        /* fall back to choosing manually */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveCurrent = current ?? baseSlot?.project ?? null;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const load = async (file, setSlot) => {
    try {
      const project = await readProjectFromFile(file);
      setSlot({ fileName: file.name, project });
      setError('');
    } catch (err) {
      setError(`Could not read ${file.name}: ${err.message}`);
    }
  };

  const addSources = async (files) => {
    const loaded = [];
    let firstError = '';
    for (const file of files) {
      try {
        loaded.push({ fileName: file.name, project: await readProjectFromFile(file) });
      } catch (err) {
        if (!firstError) firstError = `Could not read ${file.name}: ${err.message}`;
      }
    }
    if (loaded.length) setSources((existing) => [...existing, ...loaded]);
    setError(firstError);
  };

  const moveSource = (index, delta) =>
    setSources((existing) => {
      const next = [...existing];
      const target = index + delta;
      if (target < 0 || target >= next.length) return existing;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const sourceNames = sources.map((s) => s.fileName).join(', ');
  const combined = useMemo(() => (sources.length ? combineProjects(sources.map((s) => s.project)) : null), [sources]);
  const before = inProject ? (combined ? { fileName: sourceNames, project: combined } : null) : beforeSlot;

  const currentSlot = effectiveCurrent ? { fileName: 'Open project', project: effectiveCurrent } : null;
  const left = inProject ? (direction === 'toFile' ? currentSlot : before) : before;
  const right = inProject ? (direction === 'toFile' ? before : currentSlot) : after;
  const diff = useMemo(
    () => (left && right ? diffProjects(left.project, right.project) : null),
    [left, right],
  );

  const title = startMerge ? 'Merge files into a project' : current ? 'Compare or merge with a file' : 'Compare two projects';

  const doMerge = (merged, summary) => {
    if (startMerge && backup && effectiveCurrent) {
      downloadTextFile(
        `${safeFileName(effectiveCurrent.name)}-before-merge-${new Date().toISOString().slice(0, 10)}.osint.json`,
        JSON.stringify(effectiveCurrent, null, 2),
        'application/json',
      );
    }
    onMerge(merged, summary, sourceNames, effectiveCurrent);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="compare-title">{title}</h2>
        <p className="modal-sub">
          {startMerge
            ? 'Pick a project and one or more saved files or report bundles to merge into it. The result opens unsaved; the original file is not changed.'
            : current
              ? 'Pick saved project files (or report bundles) to compare with this project. Nothing is uploaded.'
              : 'Pick two saved project files (or report bundles) to see what was added, removed, or changed. Nothing is uploaded.'}
        </p>

        {inProject ? (
          <>
            <div className="compare-slots compare-slots-project">
              {startMerge ? (
                <BasePicker
                  recents={recents}
                  slot={baseSlot}
                  onRecent={(entry) => {
                    try {
                      setBaseSlot(recentSlot(entry));
                      setError('');
                    } catch (err) {
                      setError(`Could not read that project: ${err.message}`);
                    }
                  }}
                  onFile={(f) => load(f, setBaseSlot)}
                />
              ) : (
                <div className="compare-slot" data-testid="compare-open-project">
                  <div className="compare-slot-label">Open project</div>
                  <div className="compare-slot-file">
                    <strong>{current.name}</strong>
                    <span>What you are working on now</span>
                  </div>
                </div>
              )}
              <SourceList
                label={startMerge ? 'Files to merge from' : 'Saved files'}
                sources={sources}
                testId="compare-file-before"
                onFiles={addSources}
                onRemove={(index) => setSources((existing) => existing.filter((_, i) => i !== index))}
                onMove={moveSource}
              />
            </div>
            <label className="compare-direction">
              Show differences as
              <select value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direction">
                <option value="toFile">my project &rarr; the file (green: what the file adds)</option>
                <option value="fromFile">the file &rarr; my project (green: what I have added)</option>
              </select>
            </label>
          </>
        ) : (
          <div className="compare-slots">
            <FilePicker label="Earlier version" slot={beforeSlot} testId="compare-file-before" onFile={(f) => load(f, setBefore)} />
            <button
              type="button"
              className="compare-swap"
              title="Swap earlier and later"
              aria-label="Swap earlier and later"
              disabled={!beforeSlot && !after}
              onClick={() => {
                setBefore(after);
                setAfter(beforeSlot);
              }}
            >
              &#8646;
            </button>
            <FilePicker label="Later version" slot={after} testId="compare-file-after" onFile={(f) => load(f, setAfter)} />
          </div>
        )}

        {error && <div className="landing-error compare-error">{error}</div>}

        {inProject && effectiveCurrent && before && onMerge && (
          <MergePanel
            key={`${effectiveCurrent.id}:${sourceNames}`}
            current={effectiveCurrent}
            file={before}
            submitLabel={startMerge ? 'and open project' : 'into open project'}
            backup={startMerge ? { value: backup, set: changeBackup } : null}
            onMerge={doMerge}
          />
        )}

        {inProject && effectiveCurrent && <MergeHistory entries={effectiveCurrent.mergeLog} />}

        {diff && (
          <div className="compare-results" data-testid="compare-results">
            {diff.identical ? (
              <p className="compare-identical">No differences found between these two projects.</p>
            ) : (
              <>
                {diff.meta.changes.length > 0 && (
                  <section className="compare-section">
                    <h3>Project</h3>
                    <ul>
                      {diff.meta.changes.map((change) => (
                        <li key={change} className="changed">{change}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {SECTIONS.map(({ key, title: sectionTitle }) => (
                  <SectionDetails key={key} sectionKey={key} title={sectionTitle} diff={diff} />
                ))}
              </>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!diff}
            onClick={() => downloadTextFile('project-comparison.md', buildDiffMarkdown(diff), 'text/markdown')}
          >
            Download comparison (.md)
          </button>
        </div>
      </div>
    </div>
  );
}
