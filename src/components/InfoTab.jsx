import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProject } from '../context/ProjectContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useNodeHistory } from '../context/NodeHistoryContext.jsx';
import {
  getTypeDef,
  getDisplayLabel,
  getSecondaryLabel,
} from '../identifierTypes.js';
import { computeLayout } from '../utils/graphLayout.js';
import { filterIdentifiersForQuery } from '../utils/identifierSearch.js';
import IdentifierBadge from './IdentifierBadge.jsx';
import IdentifierModal from './IdentifierModal.jsx';
import IdentifierNode from './IdentifierNode.jsx';
import NodeCreationMenu from './NodeCreationMenu.jsx';
import './InfoTab.css';

const EDGE_LABEL_SUGGESTIONS = [
  'associate of',
  'family member of',
  'works for',
  'owns',
  'employs',
  'lives at',
  'communicates with',
  'linked account of',
  'same person as',
];

const NODE_TYPES = { identifier: IdentifierNode };

const DEFAULT_EDGE_OPTIONS = {
  type: 'default',
};

const OPPOSITE_HANDLE = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

export default function InfoTab() {
  return (
    <ReactFlowProvider>
      <InfoTabInner />
    </ReactFlowProvider>
  );
}

function InfoTabInner() {
  const {
    project,
    updateProject,
    addIdentifier,
    bulkAddIdentifiers,
    updateIdentifier,
    deleteIdentifier,
    addConnection,
    deleteConnection,
    updateConnection,
    addEvidenceEntry,
    removeEvidenceEntry,
  } = useProject();
  const evidenceEntries = useMemo(
    () => [...(project?.evidence ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    [project?.evidence],
  );
  const { theme } = useTheme();
  const { setHoveredIdentifierId, focus, consumeFocus } = useNavigation();
  const {
    recordCreate,
    recordBatchCreate,
    recordDelete,
    recordBatchDelete,
    recordMove,
    recordLayout,
    recordEdgeLabel,
    recordCreateEdge,
    recordBatchDeleteEdges,
    recordCreateNodeWithEdge,
    undo,
    redo,
    setClipboard,
    getClipboard,
  } = useNodeHistory();
  const dragStartPositionsRef = useRef(new Map());
  const identifiers = useMemo(
    () => project?.identifiers ?? [],
    [project?.identifiers],
  );
  const connections = useMemo(
    () => project?.connections ?? [],
    [project?.connections],
  );

  const [modalState, setModalState] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [menuState, setMenuState] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [noteDraft, setNoteDraft] = useState(null);
  const [edgeEdit, setEdgeEdit] = useState(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [focusedIdentifierId, setFocusedIdentifierId] = useState(null);
  const sidebarRowRefs = useRef(new Map());

  const filteredIdentifiers = useMemo(
    () => filterIdentifiersForQuery(identifiers, searchQuery),
    [identifiers, searchQuery],
  );

  const onEdgeDoubleClick = useCallback(
    (_event, edge) => {
      const connection = connections.find((c) => c.id === edge.id);
      if (connection) setEdgeEdit({ id: connection.id, from: connection.label ?? '', value: connection.label ?? '' });
    },
    [connections],
  );

  const commitEdgeLabel = useCallback(
    (event) => {
      event.preventDefault();
      if (!edgeEdit) return;
      const next = edgeEdit.value.trim();
      recordEdgeLabel(edgeEdit.id, edgeEdit.from, next);
      updateConnection(edgeEdit.id, { label: next });
      setEdgeEdit(null);
    },
    [edgeEdit, recordEdgeLabel, updateConnection],
  );

  const handleAutoLayout = useCallback(() => {
    const layout = computeLayout(identifiers, connections);
    const moves = identifiers.map((identifier) => ({
      id: identifier.id,
      from: identifier.position,
      to: layout.get(identifier.id),
    }));
    recordLayout(moves);
    updateProject((p) => ({
      ...p,
      identifiers: p.identifiers.map((identifier) => ({
        ...identifier,
        position: layout.get(identifier.id) ?? identifier.position,
      })),
    }));
    window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [identifiers, connections, recordLayout, updateProject, fitView]);

  // React to NavigationContext focus requests targeted at an identifier.
  useEffect(() => {
    if (!focus || focus.kind !== 'identifier') return;
    const id = focus.id;
    const token = focus.token;
    setFocusedIdentifierId(id);
    // Scroll sidebar row into view if present.
    const row = sidebarRowRefs.current.get(id);
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const clearTimer = setTimeout(() => setFocusedIdentifierId(null), 2200);
    consumeFocus(token);
    return () => clearTimeout(clearTimer);
  }, [focus, consumeFocus]);

  // Reconcile nodes from identifiers.
  // Project position is authoritative — that way undo/redo (which updates the
  // project state) actually moves the node back on the canvas. Local state is
  // only a fallback (e.g. transient state during the React Flow drag itself,
  // when the project hasn't been written yet).
  useEffect(() => {
    setNodes((current) => {
      const currentMap = new Map(current.map((n) => [n.id, n]));
      return identifiers.map((id) => {
        const existing = currentMap.get(id.id);
        return {
          id: id.id,
          type: 'identifier',
          position:
            id.position ?? existing?.position ?? { x: 60, y: 60 },
          data: { identifier: id },
          selected: existing?.selected ?? false,
        };
      });
    });
  }, [identifiers]);

  // Edges mirror project connections exactly. Dedupe by id defensively in
  // case older project state ended up with duplicate connection records.
  useEffect(() => {
    const seen = new Set();
    const deduped = [];
    for (const c of connections) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      deduped.push({
        id: c.id,
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle ?? undefined,
        targetHandle: c.targetHandle ?? undefined,
        label: c.label,
      });
    }
    setEdges(deduped);
  }, [connections]);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((ns) => applyNodeChanges(changes, ns));

      // Multiple nodes can be removed in a single change-batch (e.g. delete-key
      // on a multi-select). Capture them all up front and record as a SINGLE
      // history entry so one Ctrl+Z restores the whole batch.
      const removes = changes.filter((c) => c.type === 'remove');
      if (removes.length === 0) return;
      const items = removes
        .map((c) => {
          const ident = (project?.identifiers ?? []).find(
            (i) => i.id === c.id,
          );
          if (!ident) return null;
          const connections = (project?.connections ?? []).filter(
            (co) => co.source === c.id || co.target === c.id,
          );
          const pinLinks = (project?.pinLinks ?? []).filter(
            (l) => l.identifierId === c.id,
          );
          return { identifier: ident, connections, pinLinks };
        })
        .filter(Boolean);
      // Commit deletions to project state.
      for (const c of removes) deleteIdentifier(c.id);
      // Record undo entry (single or batched).
      if (items.length === 1) {
        recordDelete(items[0].identifier, items[0].connections, items[0].pinLinks);
      } else if (items.length > 1) {
        recordBatchDelete(items);
      }
    },
    [
      deleteIdentifier,
      project?.identifiers,
      project?.connections,
      project?.pinLinks,
      recordDelete,
      recordBatchDelete,
    ],
  );

  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((es) => applyEdgeChanges(changes, es));

      // Capture removed edge records BEFORE deletion so undo can restore them.
      const removes = changes.filter((c) => c.type === 'remove');
      if (removes.length === 0) return;
      const removed = removes
        .map((c) => (project?.connections ?? []).find((co) => co.id === c.id))
        .filter(Boolean);
      for (const c of removes) deleteConnection(c.id);
      if (removed.length === 1) recordBatchDeleteEdges([removed[0]]);
      else if (removed.length > 1) recordBatchDeleteEdges(removed);
    },
    [
      deleteConnection,
      project?.connections,
      recordBatchDeleteEdges,
    ],
  );

  const onConnect = useCallback(
    (params) => {
      const created = addConnection(
        params.source,
        params.target,
        params.sourceHandle,
        params.targetHandle,
      );
      if (created) recordCreateEdge(created);
    },
    [addConnection, recordCreateEdge],
  );

  // Blender-style: drag a wire to empty space → open a menu to create a new node.
  const onConnectEnd = useCallback(
    (event, connectionState) => {
      // Only fire when the drop wasn't on a valid handle.
      if (connectionState?.isValid) return;
      const sourceNodeId = connectionState?.fromNode?.id;
      if (!sourceNodeId) return;
      // Skip if the drop landed on an existing node body (toNode set, just no handle).
      if (connectionState?.toNode) return;
      const clientX =
        event.clientX ?? event.changedTouches?.[0]?.clientX;
      const clientY =
        event.clientY ?? event.changedTouches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setMenuState({
        sourceNodeId,
        sourceHandle: connectionState?.fromHandle?.id ?? null,
        screenX: clientX,
        screenY: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition],
  );

  const handleMenuSelect = useCallback(
    (typeKey) => {
      if (!menuState) return;
      const { sourceNodeId, sourceHandle, flowX, flowY } = menuState;
      // Offset position so the node is roughly centered on the drop point.
      const created = addIdentifier({
        type: typeKey,
        position: { x: flowX - 110, y: flowY - 30 },
      });
      let createdConn = null;
      if (created && sourceNodeId) {
        // Target handle = opposite side of the source handle so the wire
        // routes naturally (e.g., dragging from the right handle lands on
        // the new node's left handle).
        const targetHandle = sourceHandle
          ? OPPOSITE_HANDLE[sourceHandle] ?? null
          : null;
        createdConn = addConnection(
          sourceNodeId,
          created.id,
          sourceHandle,
          targetHandle,
        );
      }
      // Record node + edge as a SINGLE undo entry so one Ctrl+Z removes both.
      if (created) recordCreateNodeWithEdge(created, createdConn);
      setMenuState(null);
    },
    [menuState, addIdentifier, addConnection, recordCreateNodeWithEdge],
  );

  // Right-click on the canvas pane → open the same menu (free-floating node,
  // no auto-connection).
  const onPaneContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      const clientX =
        event.clientX ?? event.changedTouches?.[0]?.clientX;
      const clientY =
        event.clientY ?? event.changedTouches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setMenuState({
        sourceNodeId: null,
        screenX: clientX,
        screenY: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition],
  );

  const onNodeDragStart = useCallback((_event, node) => {
    // Stash the starting position so we can record the diff on dragStop.
    dragStartPositionsRef.current.set(node.id, { ...node.position });
  }, []);

  const onNodeDragStop = useCallback(
    (_event, node) => {
      const start = dragStartPositionsRef.current.get(node.id);
      dragStartPositionsRef.current.delete(node.id);
      updateIdentifier(node.id, { position: node.position });
      if (start) recordMove(node.id, start, { ...node.position });
    },
    [updateIdentifier, recordMove],
  );

  const onNodeDoubleClick = useCallback(
    (_event, node) => {
      const ident = identifiers.find((i) => i.id === node.id);
      if (ident) setModalState({ mode: 'edit', initial: ident });
    },
    [identifiers],
  );

  const openAdd = () => setModalState({ mode: 'add', initial: null });
  const openEdit = (identifier) =>
    setModalState({ mode: 'edit', initial: identifier });
  const closeModal = () => setModalState(null);

  const handleSubmit = (payload) => {
    if (modalState?.mode === 'edit' && payload.id) {
      updateIdentifier(payload.id, {
        type: payload.type,
        fields: payload.fields,
        notes: payload.notes,
        customIconId: payload.customIconId ?? null,
      });
    } else {
      const created = addIdentifier(payload);
      if (created) recordCreate(created);
    }
    closeModal();
  };

  const handleDelete = (e, id, label) => {
    e.stopPropagation();
    if (!confirm(`Delete "${label}"? You can press Ctrl+Z to restore.`)) return;
    const ident = (project?.identifiers ?? []).find((i) => i.id === id);
    const conns = (project?.connections ?? []).filter(
      (c) => c.source === id || c.target === id,
    );
    const links = (project?.pinLinks ?? []).filter(
      (l) => l.identifierId === id,
    );
    deleteIdentifier(id);
    if (ident) recordDelete(ident, conns, links);
  };

  // ---- Copy / Paste / Duplicate ---------------------------------------------
  const cloneRecordsWithOffset = useCallback((records, offset = { x: 30, y: 30 }) =>
    records.map((r) => ({
      ...r,
      id: undefined, // bulkAddIdentifiers generates fresh ids
      position: r.position
        ? { x: r.position.x + offset.x, y: r.position.y + offset.y }
        : undefined,
    })),
  []);

  const handleCopySelected = useCallback(() => {
    const selectedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedIds.size === 0) return false;
    const records = identifiers.filter((i) => selectedIds.has(i.id));
    setClipboard(records);
    return true;
  }, [nodes, identifiers, setClipboard]);

  const handlePaste = useCallback(() => {
    const records = getClipboard();
    if (!records || records.length === 0) return false;
    const created = bulkAddIdentifiers(cloneRecordsWithOffset(records));
    recordBatchCreate(created);
    return true;
  }, [getClipboard, bulkAddIdentifiers, cloneRecordsWithOffset, recordBatchCreate]);

  const handleDuplicateSelected = useCallback(() => {
    const selectedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedIds.size === 0) return false;
    const records = identifiers.filter((i) => selectedIds.has(i.id));
    if (records.length === 0) return false;
    const created = bulkAddIdentifiers(cloneRecordsWithOffset(records));
    recordBatchCreate(created);
    return true;
  }, [nodes, identifiers, bulkAddIdentifiers, cloneRecordsWithOffset, recordBatchCreate]);

  // ---- Keyboard shortcuts ----------------------------------------------------
  useEffect(() => {
    const handler = (e) => {
      // Skip when typing in inputs or while a modal is open.
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      if (modalState || menuState) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if (k === 'z') { e.preventDefault(); undo(); }
      else if (k === 'y') { e.preventDefault(); redo(); }
      else if (k === 'c') {
        if (handleCopySelected()) e.preventDefault();
      } else if (k === 'v') {
        if (handlePaste()) e.preventDefault();
      } else if (k === 'd') {
        if (handleDuplicateSelected()) e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    undo, redo,
    handleCopySelected, handlePaste, handleDuplicateSelected,
    modalState, menuState,
  ]);

  return (
    <div className="info-tab">
      <aside className="info-sidebar">
        <div className="sidebar-header">
          <h3>Identifiers</h3>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="add-identifier-button"
            onClick={openAdd}
          >
            + Add
          </button>
        </div>

        <div className="identifier-search-wrap">
          <input
            type="search"
            className="identifier-search"
            placeholder="Search identifiers"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search identifiers"
          />
        </div>

        {identifiers.length === 0 ? (
          <div className="empty-state">
            <p>No identifiers yet.</p>
            <p className="empty-hint">
              Add social profiles, phones, emails, names, vehicles, and custom
              fields here.
            </p>
          </div>
        ) : filteredIdentifiers.length === 0 ? (
          <div className="empty-state">
            <p>No matches found.</p>
            <p className="empty-hint">Try a different name, email, phone, alias, or note.</p>
          </div>
        ) : (
          <ul className="identifier-list">
            {filteredIdentifiers.map((id) => {
              const def = getTypeDef(id.type);
              const display = getDisplayLabel(id);
              const secondary = getSecondaryLabel(id);
              const isFocused = focusedIdentifierId === id.id;
              return (
                <li
                  key={id.id}
                  ref={(el) => {
                    if (el) sidebarRowRefs.current.set(id.id, el);
                    else sidebarRowRefs.current.delete(id.id);
                  }}
                  className={`identifier-item ${isFocused ? 'focused' : ''}`}
                  onClick={() => openEdit(id)}
                  onMouseEnter={() => setHoveredIdentifierId(id.id)}
                  onMouseLeave={() => setHoveredIdentifierId(null)}
                >
                  <IdentifierBadge
                    typeKey={id.type}
                    customIconId={id.customIconId}
                    size="md"
                  />
                  <div className="identifier-body">
                    <div className="identifier-type">{def.label}</div>
                    <div className="identifier-label">{display}</div>
                    {secondary && (
                      <div className="identifier-secondary">{secondary}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="identifier-delete"
                    onClick={(e) => handleDelete(e, id.id, display)}
                    aria-label={`Delete ${display}`}
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="evidence-panel">
          <div className="evidence-header">
            <h3>Evidence</h3>
            {!noteDraft && (
              <button
                type="button"
                className="btn btn-ghost evidence-add"
                onClick={() => setNoteDraft({ title: '', text: '', sourceUrl: '' })}
              >
                + Note
              </button>
            )}
          </div>
          {noteDraft && (
            <form
              className="evidence-note-form"
              onSubmit={(event) => {
                event.preventDefault();
                const created = addEvidenceEntry({
                  title: noteDraft.title.trim(),
                  text: noteDraft.text.trim(),
                  sourceUrl: noteDraft.sourceUrl.trim(),
                  subtitle: 'Manual note',
                  source: 'Analyst note',
                });
                if (created) setNoteDraft(null);
              }}
            >
              <input
                autoFocus
                value={noteDraft.title}
                onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })}
                placeholder="Title"
                aria-label="Note title"
              />
              <textarea
                rows={3}
                value={noteDraft.text}
                onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })}
                placeholder="What did you find?"
                aria-label="Note details"
              />
              <input
                type="url"
                value={noteDraft.sourceUrl}
                onChange={(e) => setNoteDraft({ ...noteDraft, sourceUrl: e.target.value })}
                placeholder="Source URL (optional)"
                aria-label="Note source URL"
              />
              <div className="evidence-note-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setNoteDraft(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!noteDraft.title.trim() || !noteDraft.text.trim()}
                >
                  Add note
                </button>
              </div>
            </form>
          )}
          {evidenceEntries.length === 0 ? (
            <div className="empty-state evidence-empty">
              <p>No public lookups yet.</p>
              <p className="empty-hint">Evidence appears here after a public record search.</p>
            </div>
          ) : (
            <ul className="evidence-list">
              {evidenceEntries.map((entry) => (
                <li key={entry.id} className="evidence-item">
                  <div className="evidence-item-header">
                    <span className="evidence-label">{entry.title}</span>
                    <span className="evidence-time">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      className="evidence-remove"
                      aria-label={`Remove evidence: ${entry.title}`}
                      title="Remove"
                      onClick={() => {
                        if (window.confirm(`Remove "${entry.title}" from evidence?`)) {
                          removeEvidenceEntry(entry.id);
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                  {entry.subtitle && (
                    <div className="evidence-subtitle">{entry.subtitle}</div>
                  )}
                  <p className="evidence-text">{entry.text}</p>
                  <div className="evidence-meta">{entry.source}</div>
                  {entry.sourceUrl && (
                    <a
                      className="evidence-link"
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open source
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="info-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onPaneContextMenu={onPaneContextMenu}
          connectionMode="loose"
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          defaultViewport={{ x: 20, y: 20, zoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode={['Control', 'Meta']}
          proOptions={{ hideAttribution: true }}
          colorMode={theme}
        >
          <Background gap={20} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap pannable zoomable />
          {identifiers.length > 1 && (
            <Panel position="top-right">
              <button
                type="button"
                className="btn btn-secondary canvas-tidy"
                onClick={handleAutoLayout}
                title="Arrange nodes by their connections (undoable)"
              >
                Tidy layout
              </button>
            </Panel>
          )}
        </ReactFlow>

        {identifiers.length === 0 && (
          <div className="canvas-hint">
            <h3>Empty canvas</h3>
            <p>
              Add identifiers from the sidebar, or <strong>right-click</strong>{' '}
              on the canvas to add one here. They'll appear as nodes you can
              drag and connect.
            </p>
            <p className="canvas-hint-tips">
              <strong>Drag a handle</strong> to another node to connect them, or
              to empty space to add a new node.<br />
              <strong>Double-click</strong> a node to edit.<br />
              <strong>Select</strong> and press <kbd>Delete</kbd> /{' '}
              <kbd>Backspace</kbd> to remove a node or edge.
            </p>
          </div>
        )}

        {identifiers.length > 0 && (
          <div className="canvas-tips" aria-hidden="true">
            <span><kbd>Drag handle</kbd> → new node</span>
            <span className="canvas-tips-sep">·</span>
            <span><kbd>Double-click</kbd> a line to label it</span>
            <span className="canvas-tips-sep">·</span>
            <span><kbd>Right-click</kbd> menu</span>
            <span className="canvas-tips-sep">·</span>
            <span><kbd>⌘D</kbd> duplicate</span>
            <span className="canvas-tips-sep">·</span>
            <span><kbd>⌘Z</kbd> / <kbd>⌘Y</kbd></span>
            <span className="canvas-tips-sep">·</span>
            <span><kbd>Del</kbd> remove</span>
          </div>
        )}
      </div>

      {edgeEdit && (
        <div className="modal-backdrop" onClick={() => setEdgeEdit(null)}>
          <form
            className="modal edge-label-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edge-label-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={commitEdgeLabel}
            onKeyDown={(e) => { if (e.key === 'Escape') setEdgeEdit(null); }}
          >
            <h2 id="edge-label-title">Relationship</h2>
            <p className="modal-sub">Describe how these two identifiers are related.</p>
            <div className="field">
              <label htmlFor="edge-label-input">Label</label>
              <input
                id="edge-label-input"
                autoFocus
                list="edge-label-suggestions"
                value={edgeEdit.value}
                onChange={(e) => setEdgeEdit({ ...edgeEdit, value: e.target.value })}
                placeholder="e.g. associate of"
                maxLength={60}
              />
              <datalist id="edge-label-suggestions">
                {EDGE_LABEL_SUGGESTIONS.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEdgeEdit(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">Save label</button>
            </div>
          </form>
        </div>
      )}

      {modalState && (
        <IdentifierModal
          initial={modalState.initial}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {menuState && (
        <NodeCreationMenu
          position={{ x: menuState.screenX, y: menuState.screenY }}
          onSelect={handleMenuSelect}
          onClose={() => setMenuState(null)}
        />
      )}
    </div>
  );
}
