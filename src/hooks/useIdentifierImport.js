import { useEffect, useRef, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { useNodeHistory } from '../context/NodeHistoryContext.jsx';

const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

// The sidebar's Import button: identifiers from a CSV, or saved views from a
// JSON export. The parsers are only downloaded when a file is actually chosen.
export function useIdentifierImport(identifiers) {
  const { addFilterPresets, bulkAddIdentifiers } = useProject();
  const { recordBatchCreate } = useNodeHistory();
  const [status, setStatus] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (status?.tone !== 'ok') return undefined;
    const timer = window.setTimeout(() => setStatus(null), 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const fail = (message) => setStatus({ tone: 'error', message: `Import failed: ${message}` });

  const importViews = async (text) => {
    const { parseViewsImport } = await import('../utils/viewsIO.js');
    const { views, error } = parseViewsImport(text);
    if (error) return fail(error);
    const replaced = addFilterPresets(views);
    const base = `Imported ${plural(views.length, 'saved view')}`;
    return setStatus({ tone: 'ok', message: replaced ? `${base} (${replaced} replaced)` : base });
  };

  const importIdentifiers = async (text) => {
    const { identifiersFromCsv } = await import('../utils/importCsv.js');
    const { records, skipped, error } = identifiersFromCsv(text, identifiers);
    if (error) return fail(error);
    if (records.length > 0) recordBatchCreate(bulkAddIdentifiers(records));
    const duplicates = skipped.filter((row) => row.reason === 'duplicate').length;
    const unusable = skipped.length - duplicates;
    const parts = [`Imported ${plural(records.length, 'identifier')}`];
    if (duplicates) parts.push(`${plural(duplicates, 'duplicate')} skipped`);
    if (unusable) parts.push(`${plural(unusable, 'unusable row')} skipped`);
    return setStatus({ tone: records.length > 0 ? 'ok' : 'error', message: parts.join(', ') });
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (/\.json$/i.test(file.name) || text.trimStart().startsWith('{')) await importViews(text);
      else await importIdentifiers(text);
    } catch {
      fail('could not read that file.');
    }
  };

  return {
    status,
    dismiss: () => setStatus(null),
    inputRef,
    openPicker: () => inputRef.current?.click(),
    onFile,
  };
}
