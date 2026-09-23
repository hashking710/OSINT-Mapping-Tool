import { useEffect, useMemo, useRef, useState } from 'react';
import { readProjectFromFile } from '../utils/projectIO.js';
import { buildDiffMarkdown, diffProjects } from '../utils/projectDiff.js';
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
        accept="application/json,.json"
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

export default function CompareDialog({ onClose }) {
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [error, setError] = useState('');

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

  const diff = useMemo(() => (before && after ? diffProjects(before.project, after.project) : null), [before, after]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="compare-title">Compare two projects</h2>
        <p className="modal-sub">
          Pick two saved project files to see what was added, removed, or changed. Nothing is uploaded.
        </p>

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

        {error && <div className="landing-error compare-error">{error}</div>}

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
            className="btn btn-primary"
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
