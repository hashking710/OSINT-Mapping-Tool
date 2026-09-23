import { useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { useNodeHistory } from '../context/NodeHistoryContext.jsx';
import { cloneRecordsWithOffset } from '../utils/identifierClone.js';

// "Select" mode in the identifier sidebar: pick several identifiers, then
// duplicate, delete, tag or colour them together. Every action is a single
// undo step.
export function useBulkSelection({ identifiers, filteredIdentifiers }) {
  const { project, updateProject, bulkAddIdentifiers } = useProject();
  const { recordIdentifierPatch, recordBatchDelete, recordBatchCreate } = useNodeHistory();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [labelOpen, setLabelOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  const selection = identifiers.filter((i) => selectedIds.has(i.id));

  const toggle = (id) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exit = () => {
    setLabelOpen(false);
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const selectAllShown = () => setSelectedIds(new Set(filteredIdentifiers.map((i) => i.id)));

  const applyLabels = (change) => {
    if (selection.length === 0) return;
    const now = new Date().toISOString();
    const items = selection.map((identifier) => {
      const from = { color: identifier.color ?? null, tags: identifier.tags ?? [] };
      return { id: identifier.id, from, to: { ...from, ...change(identifier) } };
    });
    recordIdentifierPatch(items);
    const byId = new Map(items.map((item) => [item.id, item.to]));
    updateProject((p) => ({
      ...p,
      identifiers: p.identifiers.map((i) => (byId.has(i.id) ? { ...i, ...byId.get(i.id), updatedAt: now } : i)),
    }));
  };

  const deleteSelected = () => {
    if (selection.length === 0) return;
    const noun = selection.length === 1 ? 'identifier' : 'identifiers';
    if (!confirm(`Delete ${selection.length} ${noun}? You can press Ctrl+Z to restore.`)) return;
    const ids = new Set(selection.map((i) => i.id));
    const items = selection.map((identifier) => ({
      identifier,
      connections: (project?.connections ?? []).filter((c) => c.source === identifier.id || c.target === identifier.id),
      pinLinks: (project?.pinLinks ?? []).filter((l) => l.identifierId === identifier.id),
    }));
    updateProject((p) => ({
      ...p,
      identifiers: p.identifiers.filter((i) => !ids.has(i.id)),
      connections: p.connections.filter((c) => !ids.has(c.source) && !ids.has(c.target)),
      pinLinks: (p.pinLinks ?? []).filter((l) => !ids.has(l.identifierId)),
    }));
    recordBatchDelete(items);
    exit();
  };

  const duplicateSelected = () => {
    if (selection.length === 0) return;
    recordBatchCreate(bulkAddIdentifiers(cloneRecordsWithOffset(selection)));
    exit();
  };

  return {
    selectMode,
    enter: () => setSelectMode(true),
    exit,
    selectedIds,
    selection,
    toggle,
    selectAllShown,
    labelOpen,
    toggleLabelOpen: () => setLabelOpen((open) => !open),
    tagDraft,
    setTagDraft,
    applyLabels,
    deleteSelected,
    duplicateSelected,
  };
}
