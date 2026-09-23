import { useEffect, useMemo, useState } from 'react';
import { useMergeSources } from '../hooks/useMergeSources.js';
import { downloadTextFile, safeFileName } from '../utils/download.js';
import { buildDiffMarkdown, diffProjects } from '../utils/projectDiff.js';
import { readProjectFromFile, validateProject } from '../utils/projectIO.js';
import DiffResults from './merge/DiffResults.jsx';
import MergeHistory from './merge/MergeHistory.jsx';
import MergePanel from './merge/MergePanel.jsx';
import { BasePicker, FilePicker, SourceList } from './merge/SourcePickers.jsx';
import './CompareDialog.css';

const BACKUP_KEY = 'osint-tool:merge-backup';

const readBackupPreference = () => {
  try {
    return window.localStorage.getItem(BACKUP_KEY) !== 'off';
  } catch {
    return true;
  }
};

const recentSlot = (entry) => ({
  recentId: entry.id,
  fileName: 'Recent project on this device',
  project: validateProject(entry.snapshot),
});

// Three ways to use it:
//  - standalone: compare two files
//  - `current` (the open project): compare it with one or more files and merge them in
//  - `startMerge` with `recents`: pick a project and files, merge, then open the result
export default function CompareDialog({ onClose, current = null, onMerge = null, startMerge = false, recents = [] }) {
  const inProject = !!current || startMerge;

  // Standalone comparison: two single files.
  const [beforeSlot, setBeforeSlot] = useState(null);
  const [afterSlot, setAfterSlot] = useState(null);
  // In-project / start-screen merge: any number of source files, and (start
  // screen only) the project they are merged into.
  const merge = useMergeSources();
  const [baseSlot, setBaseSlot] = useState(null);
  // 'toFile': my project -> the file, so green means "what the file adds" (what a merge brings in).
  const [direction, setDirection] = useState('toFile');
  const [pickError, setPickError] = useState('');
  const [backup, setBackup] = useState(readBackupPreference);

  const error = pickError || merge.error;
  const effectiveCurrent = current ?? baseSlot?.project ?? null;

  // Start screen: default the target to the most recent project.
  useEffect(() => {
    if (!startMerge || recents.length === 0) return;
    try {
      setBaseSlot(recentSlot(recents[0]));
    } catch {
      /* fall back to choosing manually */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const loadInto = async (file, setSlot) => {
    try {
      setSlot({ fileName: file.name, project: await readProjectFromFile(file) });
      setPickError('');
    } catch (err) {
      setPickError(`Could not read ${file.name}: ${err.message}`);
    }
  };

  const changeBackup = (value) => {
    setBackup(value);
    try {
      window.localStorage.setItem(BACKUP_KEY, value ? 'on' : 'off');
    } catch {
      /* the preference just is not remembered */
    }
  };

  const sourceSlot = inProject ? merge.slot : beforeSlot;
  const openProjectSlot = effectiveCurrent ? { fileName: 'Open project', project: effectiveCurrent } : null;
  const left = inProject ? (direction === 'toFile' ? openProjectSlot : sourceSlot) : beforeSlot;
  const right = inProject ? (direction === 'toFile' ? sourceSlot : openProjectSlot) : afterSlot;
  const diff = useMemo(
    () => (left && right ? diffProjects(left.project, right.project) : null),
    [left, right],
  );

  const doMerge = (merged, summary, details = {}) => {
    if (startMerge && backup && effectiveCurrent) {
      downloadTextFile(
        `${safeFileName(effectiveCurrent.name)}-before-merge-${new Date().toISOString().slice(0, 10)}.osint.json`,
        JSON.stringify(effectiveCurrent, null, 2),
        'application/json',
      );
    }
    onMerge(merged, summary, { source: merge.names, ...details }, effectiveCurrent);
    onClose();
  };

  const title = startMerge ? 'Merge files into a project' : current ? 'Compare or merge with a file' : 'Compare two projects';
  const intro = startMerge
    ? 'Pick a project and one or more saved files or report bundles to merge into it. The result opens unsaved; the original file is not changed.'
    : current
      ? 'Pick saved project files (or report bundles) to compare with this project. Nothing is uploaded.'
      : 'Pick two saved project files (or report bundles) to see what was added, removed, or changed. Nothing is uploaded.';

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
        <p className="modal-sub">{intro}</p>

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
                      setPickError('');
                    } catch (err) {
                      setPickError(`Could not read that project: ${err.message}`);
                    }
                  }}
                  onFile={(file) => loadInto(file, setBaseSlot)}
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
                sources={merge.sources}
                testId="compare-file-before"
                onFiles={merge.addFiles}
                onRemove={merge.remove}
                onMove={merge.move}
                onMode={merge.setMode}
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
            <FilePicker label="Earlier version" slot={beforeSlot} testId="compare-file-before" onFile={(f) => loadInto(f, setBeforeSlot)} />
            <button
              type="button"
              className="compare-swap"
              title="Swap earlier and later"
              aria-label="Swap earlier and later"
              disabled={!beforeSlot && !afterSlot}
              onClick={() => {
                setBeforeSlot(afterSlot);
                setAfterSlot(beforeSlot);
              }}
            >
              &#8646;
            </button>
            <FilePicker label="Later version" slot={afterSlot} testId="compare-file-after" onFile={(f) => loadInto(f, setAfterSlot)} />
          </div>
        )}

        {error && <div className="landing-error compare-error">{error}</div>}

        {inProject && effectiveCurrent && merge.slot && onMerge && (
          <MergePanel
            key={`${effectiveCurrent.id}:${merge.names}`}
            current={effectiveCurrent}
            file={merge.slot}
            submitLabel={startMerge ? 'and open project' : 'into open project'}
            backup={startMerge ? { value: backup, set: changeBackup } : null}
            onMerge={doMerge}
          />
        )}

        {inProject && effectiveCurrent && <MergeHistory entries={effectiveCurrent.mergeLog} />}

        {diff && (
          <div className="compare-results" data-testid="compare-results">
            <DiffResults diff={diff} />
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
