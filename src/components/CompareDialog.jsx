import { useEffect, useMemo, useRef, useState } from 'react';
import { readProjectFromFile } from '../utils/projectIO.js';
import { buildDiffMarkdown, diffProjects } from '../utils/projectDiff.js';
import { ALL_MERGE_OPTIONS, DEFAULT_MERGE_OPTIONS, mergeProjects } from '../utils/projectMerge.js';
import { downloadTextFile } from '../utils/download.js';
import './CompareDialog.css';

const SECTIONS = [
  { key: 'identifiers', title: 'Identifiers' },
  { key: 'connections', title: 'Connections' },
  { key: 'locations', title: 'Locations' },
  { key: 'pinLinks', title: 'Pin links' },
  { key: 'evidence', title: 'Evidence' },
];

const evidenceText = (e) => `${e.date} ${e.title} (${e.source})`;

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

function MergePanel({ current, file, options, setOptions, onMerge }) {
  const available = useMemo(() => mergeProjects(current, file.project, ALL_MERGE_OPTIONS).summary, [current, file]);
  const preview = useMemo(() => mergeProjects(current, file.project, options), [current, file, options]);
  const { added, updated } = available;
  const updates = updated.identifiers + updated.connections + updated.locations;

  const rows = [
    { key: 'identifiers', label: 'Add new identifiers', count: added.identifiers },
    { key: 'connections', label: 'Add new connections', count: added.connections },
    { key: 'locations', label: 'Add new locations and pin links', count: added.locations + added.pinLinks },
    { key: 'evidence', label: 'Add new evidence', count: added.evidence },
    { key: 'views', label: 'Add saved views', count: added.views },
    { key: 'updateChanged', label: 'Overwrite my copies of changed items with the file’s version', count: updates },
  ];

  return (
    <section className="merge-panel" data-testid="merge-panel">
      <h3>Merge into the open project</h3>
      <p className="merge-note">
        Bring changes from the file into this project. Nothing is ever deleted, and you can undo right after.
      </p>
      <ul className="merge-options">
        {rows.map(({ key, label, count }) => (
          <li key={key}>
            <label className={count === 0 ? 'disabled' : ''}>
              <input
                type="checkbox"
                checked={!!options[key] && count > 0}
                disabled={count === 0}
                onChange={(e) => setOptions((o) => ({ ...o, [key]: e.target.checked }))}
              />
              <span>
                {label} <span className="merge-count">({count})</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-primary"
        data-testid="merge-button"
        disabled={preview.total === 0}
        onClick={() => onMerge(preview.project, preview.summary)}
      >
        {preview.total === 0
          ? 'Nothing to merge'
          : `Merge ${preview.total} change${preview.total === 1 ? '' : 's'} into open project`}
      </button>
    </section>
  );
}

// Standalone (from the start screen) it compares two files. Given `current`
// (the open project) it compares the open project with one file and can merge
// the file's changes into the open project.
export default function CompareDialog({ onClose, current = null, onMerge = null }) {
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  // 'toFile': my project -> the file, so green means "what the file adds" (what a merge brings in).
  const [direction, setDirection] = useState('toFile');
  const [mergeOptions, setMergeOptions] = useState(DEFAULT_MERGE_OPTIONS);
  const [error, setError] = useState('');
  const inProject = !!current;

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

  const currentSlot = inProject ? { fileName: 'Open project', project: current } : null;
  const left = inProject ? (direction === 'toFile' ? currentSlot : before) : before;
  const right = inProject ? (direction === 'toFile' ? before : currentSlot) : after;
  const diff = useMemo(
    () => (left && right ? diffProjects(left.project, right.project) : null),
    [left, right],
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="compare-title">{inProject ? 'Compare or merge with a file' : 'Compare two projects'}</h2>
        <p className="modal-sub">
          {inProject
            ? 'Pick a saved project file (or report bundle) to compare with this project. Nothing is uploaded.'
            : 'Pick two saved project files (or report bundles) to see what was added, removed, or changed. Nothing is uploaded.'}
        </p>

        {inProject ? (
          <>
            <div className="compare-slots compare-slots-project">
              <FilePicker label="Saved file" slot={before} testId="compare-file-before" onFile={(f) => load(f, setBefore)} />
              <div className="compare-slot" data-testid="compare-open-project">
                <div className="compare-slot-label">Open project</div>
                <div className="compare-slot-file">
                  <strong>{current.name}</strong>
                  <span>What you are working on now</span>
                </div>
              </div>
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
            <FilePicker label="Earlier version" slot={before} testId="compare-file-before" onFile={(f) => load(f, setBefore)} />
            <button
              type="button"
              className="compare-swap"
              title="Swap earlier and later"
              aria-label="Swap earlier and later"
              disabled={!before && !after}
              onClick={() => {
                setBefore(after);
                setAfter(before);
              }}
            >
              &#8646;
            </button>
            <FilePicker label="Later version" slot={after} testId="compare-file-after" onFile={(f) => load(f, setAfter)} />
          </div>
        )}

        {error && <div className="landing-error compare-error">{error}</div>}

        {inProject && before && onMerge && (
          <MergePanel
            current={current}
            file={before}
            options={mergeOptions}
            setOptions={setMergeOptions}
            onMerge={(merged, summary) => {
              onMerge(merged, summary);
              onClose();
            }}
          />
        )}

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
                {SECTIONS.map(({ key, title }) => (
                  <SectionDetails key={key} sectionKey={key} title={title} diff={diff} />
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
