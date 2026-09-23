import { useEffect, useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext.jsx';
import { getDisplayLabel } from '../../identifierTypes.js';
import { evidenceForIdentifier } from '../../utils/evidenceLinks.js';
import { filterEvidence } from '../../utils/evidenceSearch.js';
import { downloadTextFile, safeFileName } from '../../utils/download.js';
import CopyButton from '../CopyButton.jsx';

const EMPTY_NOTE = { title: '', text: '', sourceUrl: '' };

function NoteForm({ onSubmit, onCancel }) {
  const [draft, setDraft] = useState(EMPTY_NOTE);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <form
      className="evidence-note-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          title: draft.title.trim(),
          text: draft.text.trim(),
          sourceUrl: draft.sourceUrl.trim(),
          subtitle: 'Manual note',
          source: 'Analyst note',
        });
      }}
    >
      <input autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Title" aria-label="Note title" />
      <textarea
        rows={3}
        value={draft.text}
        onChange={(e) => set({ text: e.target.value })}
        placeholder="What did you find?"
        aria-label="Note details"
      />
      <input
        type="url"
        value={draft.sourceUrl}
        onChange={(e) => set({ sourceUrl: e.target.value })}
        placeholder="Source URL (optional)"
        aria-label="Note source URL"
      />
      <div className="evidence-note-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!draft.title.trim() || !draft.text.trim()}>
          Add note
        </button>
      </div>
    </form>
  );
}

function EvidenceItem({ entry, onRemove }) {
  return (
    <li className="evidence-item">
      <div className="evidence-item-header">
        <span className="evidence-label">{entry.title}</span>
        <span className="evidence-time">{new Date(entry.createdAt).toLocaleDateString()}</span>
        <button
          type="button"
          className="evidence-remove"
          aria-label={`Remove evidence: ${entry.title}`}
          title="Remove"
          onClick={() => {
            if (window.confirm(`Remove "${entry.title}" from evidence?`)) onRemove(entry.id);
          }}
        >
          &times;
        </button>
      </div>
      {entry.subtitle && <div className="evidence-subtitle">{entry.subtitle}</div>}
      <p className="evidence-text">{entry.text}</p>
      <div className="evidence-meta">{entry.source}</div>
      {entry.sourceUrl && (
        <div className="evidence-actions">
          <a className="evidence-link" href={entry.sourceUrl} target="_blank" rel="noreferrer">
            Open source
          </a>
          <CopyButton text={entry.sourceUrl} label="Copy link" />
        </div>
      )}
    </li>
  );
}

// The evidence list under the identifiers: filterable, manual notes, and (when
// an identifier is focused) a per-identifier dossier export.
export default function EvidencePanel({ panelRef, focusIdentifier, focusToken, onClearFocus }) {
  const { project, addEvidenceEntry, removeEvidenceEntry } = useProject();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  // Choosing an identifier's evidence starts from a clean search.
  useEffect(() => setQuery(''), [focusIdentifier?.id, focusToken]);

  const entries = useMemo(
    () => [...(project?.evidence ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [project?.evidence],
  );
  const visible = useMemo(
    () => filterEvidence(focusIdentifier ? evidenceForIdentifier(entries, focusIdentifier) : entries, query),
    [entries, query, focusIdentifier],
  );

  const saveDossier = async () => {
    const { buildIdentifierDossier } = await import('../../utils/caseReport.js');
    const name = `${safeFileName(project.name)}-${safeFileName(getDisplayLabel(focusIdentifier), 'identifier')}-dossier.md`;
    downloadTextFile(name, buildIdentifierDossier(project, focusIdentifier.id), 'text/markdown');
  };
  const printDossier = async () => {
    const [{ buildIdentifierDossierHtml }, { printHtmlDocument }] = await Promise.all([
      import('../../utils/caseReport.js'),
      import('../../utils/download.js'),
    ]);
    printHtmlDocument(buildIdentifierDossierHtml(project, focusIdentifier.id));
  };

  return (
    <div className="evidence-panel" ref={panelRef}>
      <div className="evidence-header">
        <h3>Evidence</h3>
        {!adding && (
          <button type="button" className="btn btn-ghost evidence-add" onClick={() => setAdding(true)}>
            + Note
          </button>
        )}
      </div>

      {adding && (
        <NoteForm
          onCancel={() => setAdding(false)}
          onSubmit={(note) => {
            if (addEvidenceEntry(note)) setAdding(false);
          }}
        />
      )}

      {focusIdentifier && (
        <div className="evidence-focus">
          <span className="evidence-focus-title">Evidence for {getDisplayLabel(focusIdentifier)}</span>
          <div className="evidence-focus-actions">
            <button
              type="button"
              data-testid="save-dossier"
              title="Save this identifier's details and evidence as a Markdown report"
              onClick={saveDossier}
            >
              Save report
            </button>
            <button type="button" title="Print or save as PDF" onClick={printDossier}>Print</button>
            <button type="button" onClick={onClearFocus}>Show all</button>
          </div>
        </div>
      )}

      {entries.length > 2 && (
        <div className="evidence-search-wrap">
          <input
            type="search"
            className="identifier-search"
            placeholder={`Filter ${entries.length} evidence entries`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter evidence"
          />
        </div>
      )}

      {entries.length === 0 ? (
        <div className="empty-state evidence-empty">
          <p>No public lookups yet.</p>
          <p className="empty-hint">Evidence appears here after a public record search.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state evidence-empty">
          <p>No matching evidence.</p>
        </div>
      ) : (
        <ul className="evidence-list">
          {visible.map((entry) => (
            <EvidenceItem key={entry.id} entry={entry} onRemove={removeEvidenceEntry} />
          ))}
        </ul>
      )}
    </div>
  );
}
