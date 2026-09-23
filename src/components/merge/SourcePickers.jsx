import { useRef } from 'react';

export function FilePicker({ label, slot, testId, onFile }) {
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
export function SourceList({ label, sources, testId, onFiles, onRemove, onMove }) {
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
export function BasePicker({ recents, slot, onRecent, onFile }) {
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
