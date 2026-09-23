import { useEffect, useMemo, useState } from 'react';
import {
  ALL_BUNDLE_SECTION_KEYS,
  BUNDLE_SECTIONS,
  availableBundleSections,
  buildReportBundleZip,
} from '../utils/bundle.js';
import { downloadBytes, safeFileName } from '../utils/download.js';

const STORAGE_KEY = 'osint-tool:bundle-sections';

function loadSelection() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored)) return new Set(stored.filter((key) => ALL_BUNDLE_SECTION_KEYS.includes(key)));
  } catch {
    /* fall through to the default */
  }
  return new Set(ALL_BUNDLE_SECTION_KEYS);
}

export default function BundleDialog({ project, groupBy, onClose }) {
  const [selected, setSelected] = useState(loadSelection);
  const available = useMemo(() => availableBundleSections(project), [project]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isEmpty = (key) => (key === 'dossiers' && available.dossiers === 0) || (key === 'views' && available.views === 0);
  const effective = ALL_BUNDLE_SECTION_KEYS.filter((key) => selected.has(key) && !isEmpty(key));

  const toggle = (key) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const download = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    } catch {
      /* choices just will not be remembered */
    }
    downloadBytes(
      `${safeFileName(project.name)}-bundle.zip`,
      buildReportBundleZip(project, { groupBy, include: effective }),
      'application/zip',
    );
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal bundle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bundle-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="bundle-title">Report bundle</h2>
        <p className="modal-sub">
          A single .zip you can share. Everything is built in your browser. Choose what goes inside.
        </p>

        <ul className="bundle-list">
          {BUNDLE_SECTIONS.map(({ key, label, detail }) => {
            const empty = isEmpty(key);
            const suffix =
              key === 'dossiers' && !empty ? ` (${available.dossiers})` : empty ? ' (none in this project)' : '';
            return (
              <li key={key}>
                <label className={`bundle-option ${empty ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(key) && !empty}
                    disabled={empty}
                    onChange={() => toggle(key)}
                  />
                  <span className="bundle-option-text">
                    <span className="bundle-option-label">
                      {label}
                      {suffix}
                    </span>
                    <span className="bundle-option-detail">{detail}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="download-bundle"
            disabled={effective.length === 0}
            onClick={download}
          >
            Download bundle
          </button>
        </div>
      </div>
    </div>
  );
}
