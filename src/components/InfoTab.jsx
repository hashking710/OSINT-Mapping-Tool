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
import { useBulkSelection } from '../hooks/useBulkSelection.js';
import { useIdentifierFilters } from '../hooks/useIdentifierFilters.js';
import { useIdentifierImport } from '../hooks/useIdentifierImport.js';
import { evidenceForIdentifier } from '../utils/evidenceLinks.js';
import { computeLayout } from '../utils/graphLayout.js';
import { cloneRecordsWithOffset } from '../utils/identifierClone.js';
import BulkBar from './info/BulkBar.jsx';
import CanvasHints from './info/CanvasHints.jsx';
import EdgeLabelDialog from './info/EdgeLabelDialog.jsx';
import EvidencePanel from './info/EvidencePanel.jsx';
import IdentifierList from './info/IdentifierList.jsx';
import IdentifierRow from './info/IdentifierRow.jsx';
import LabelFilterBar from './info/LabelFilterBar.jsx';
import PresetBar from './info/PresetBar.jsx';
import IdentifierModal from './IdentifierModal.jsx';
import IdentifierNode from './IdentifierNode.jsx';
import NodeCreationMenu from './NodeCreationMenu.jsx';
import { SidebarTitle, useSidebarCollapse } from './SidebarToggle.jsx';
import './InfoTab.css';

const NODE_TYPES = { identifier: IdentifierNode };
const DEFAULT_EDGE_OPTIONS = { type: 'default' };
const OPPOSITE_HANDLE = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' };

const pointerPosition = (event) => ({
  x: event.clientX ?? event.changedTouches?.[0]?.clientX,
  y: event.clientY ?? event.changedTouches?.[0]?.clientY,
});

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
    removeFilterPreset,
  } = useProject();
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
  const { screenToFlowPosition, fitView } = useReactFlow();

  const identifiers = useMemo(() => project?.identifiers ?? [], [project?.identifiers]);
  const connections = useMemo(() => project?.connections ?? [], [project?.connections]);

  const filters = useIdentifierFilters(identifiers);
  const bulk = useBulkSelection({ identifiers, filteredIdentifiers: filters.filteredIdentifiers });
  const importer = useIdentifierImport(identifiers);
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapse();

  const [modalState, setModalState] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [menuState, setMenuState] = useState(null);
  const [edgeEdit, setEdgeEdit] = useState(null);
  const [focusedIdentifierId, setFocusedIdentifierId] = useState(null);
  const [evidenceFocus, setEvidenceFocus] = useState(null);
  const sidebarRowRefs = useRef(new Map());
  const evidencePanelRef = useRef(null);
  const dragStartPositionsRef = useRef(new Map());

  const evidenceFocusIdentifier = useMemo(
    () => identifiers.find((i) => i.id === evidenceFocus?.id) ?? null,
    [identifiers, evidenceFocus],
  );
  const evidenceCounts = useMemo(
    () => new Map(identifiers.map((i) => [i.id, evidenceForIdentifier(project?.evidence ?? [], i).length])),
    [identifiers, project?.evidence],
  );

  const showEvidenceFor = (identifier) => {
    setEvidenceFocus({ id: identifier.id, token: Date.now() });
    window.setTimeout(() => evidencePanelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
  };

  // ---- Edge labels ----------------------------------------------------------
  const onEdgeDoubleClick = useCallback(
    (_event, edge) => {
      const connection = connections.find((c) => c.id === edge.id);
      if (connection) setEdgeEdit({ id: connection.id, from: connection.label ?? '', value: connection.label ?? '' });
    },
    [connections],
  );

  const commitEdgeLabel = (event) => {
    event.preventDefault();
    if (!edgeEdit) return;
    const next = edgeEdit.value.trim();
    recordEdgeLabel(edgeEdit.id, edgeEdit.from, next);
    updateConnection(edgeEdit.id, { label: next });
    setEdgeEdit(null);
  };

  // ---- Auto layout ----------------------------------------------------------
  const handleAutoLayout = useCallback(() => {
    const layout = computeLayout(identifiers, connections);
    recordLayout(
      identifiers.map((identifier) => ({
        id: identifier.id,
        from: identifier.position,
        to: layout.get(identifier.id),
      })),
    );
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
    if (!focus || focus.kind !== 'identifier') return undefined;
    setFocusedIdentifierId(focus.id);
    sidebarRowRefs.current.get(focus.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const clearTimer = setTimeout(() => setFocusedIdentifierId(null), 2200);
    consumeFocus(focus.token);
    return () => clearTimeout(clearTimer);
  }, [focus, consumeFocus]);

  // Reconcile nodes from identifiers. Project position is authoritative, so
  // undo/redo (which updates the project) moves the node back on the canvas.
  // Local state is only a fallback while a drag is in flight.
  useEffect(() => {
    setNodes((current) => {
      const currentMap = new Map(current.map((n) => [n.id, n]));
      return identifiers.map((identifier) => ({
        id: identifier.id,
        type: 'identifier',
        position: identifier.position ?? currentMap.get(identifier.id)?.position ?? { x: 60, y: 60 },
        data: { identifier, dimmed: filters.dimmedIds.has(identifier.id), onTagClick: filters.toggleNodeTag },
        selected: currentMap.get(identifier.id)?.selected ?? false,
      }));
    });
  }, [identifiers, filters.dimmedIds, filters.toggleNodeTag]);

  // Edges mirror project connections exactly (deduped by id defensively).
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

  // ---- Canvas change handlers -------------------------------------------------
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((ns) => applyNodeChanges(changes, ns));

      // Several nodes can be removed in one batch (delete key on a multi-select);
      // record them as a single history entry so one Ctrl+Z restores them all.
      const removes = changes.filter((c) => c.type === 'remove');
      if (removes.length === 0) return;
      const items = removes
        .map((c) => {
          const identifier = identifiers.find((i) => i.id === c.id);
          if (!identifier) return null;
          return {
            identifier,
            connections: connections.filter((co) => co.source === c.id || co.target === c.id),
            pinLinks: (project?.pinLinks ?? []).filter((l) => l.identifierId === c.id),
          };
        })
        .filter(Boolean);
      for (const c of removes) deleteIdentifier(c.id);
      if (items.length === 1) recordDelete(items[0].identifier, items[0].connections, items[0].pinLinks);
      else if (items.length > 1) recordBatchDelete(items);
    },
    [deleteIdentifier, identifiers, connections, project?.pinLinks, recordDelete, recordBatchDelete],
  );

  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((es) => applyEdgeChanges(changes, es));

      // Capture removed connections BEFORE deletion so undo can restore them.
      const removes = changes.filter((c) => c.type === 'remove');
      if (removes.length === 0) return;
      const removed = removes.map((c) => connections.find((co) => co.id === c.id)).filter(Boolean);
      for (const c of removes) deleteConnection(c.id);
      if (removed.length > 0) recordBatchDeleteEdges(removed);
    },
    [deleteConnection, connections, recordBatchDeleteEdges],
  );

  const onConnect = useCallback(
    (params) => {
      const created = addConnection(params.source, params.target, params.sourceHandle, params.targetHandle);
      if (created) recordCreateEdge(created);
    },
    [addConnection, recordCreateEdge],
  );

  const openMenuAt = useCallback(
    (event, extra = {}) => {
      const { x, y } = pointerPosition(event);
      if (x == null || y == null) return;
      const flow = screenToFlowPosition({ x, y });
      setMenuState({ screenX: x, screenY: y, flowX: flow.x, flowY: flow.y, sourceNodeId: null, ...extra });
    },
    [screenToFlowPosition],
  );

  // Blender-style: drag a wire to empty space to open a menu that creates a new node.
  const onConnectEnd = useCallback(
    (event, connectionState) => {
      // Only when the drop was not on a valid handle or an existing node body.
      if (connectionState?.isValid || connectionState?.toNode) return;
      const sourceNodeId = connectionState?.fromNode?.id;
      if (!sourceNodeId) return;
      openMenuAt(event, { sourceNodeId, sourceHandle: connectionState?.fromHandle?.id ?? null });
    },
    [openMenuAt],
  );

  const handleMenuSelect = useCallback(
    (typeKey) => {
      if (!menuState) return;
      const { sourceNodeId, sourceHandle, flowX, flowY } = menuState;
      // Centre the new node roughly on the drop point.
      const created = addIdentifier({ type: typeKey, position: { x: flowX - 110, y: flowY - 30 } });
      let createdConn = null;
      if (created && sourceNodeId) {
        // Land on the opposite side of the source handle so the wire routes naturally.
        const targetHandle = sourceHandle ? OPPOSITE_HANDLE[sourceHandle] ?? null : null;
        createdConn = addConnection(sourceNodeId, created.id, sourceHandle, targetHandle);
      }
      // Node + edge are one undo step.
      if (created) recordCreateNodeWithEdge(created, createdConn);
      setMenuState(null);
    },
    [menuState, addIdentifier, addConnection, recordCreateNodeWithEdge],
  );

  // Right-click on the pane opens the same menu for a free-floating node.
  const onPaneContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      openMenuAt(event);
    },
    [openMenuAt],
  );

  const onNodeDragStart = useCallback((_event, node) => {
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

  // ---- Identifier editing -------------------------------------------------------
  const openAdd = () => setModalState({ mode: 'add', initial: null });
  const openEdit = (identifier) => setModalState({ mode: 'edit', initial: identifier });
  const closeModal = () => setModalState(null);

  const onNodeDoubleClick = useCallback(
    (_event, node) => {
      const identifier = identifiers.find((i) => i.id === node.id);
      if (identifier) setModalState({ mode: 'edit', initial: identifier });
    },
    [identifiers],
  );

  const handleSubmit = (payload) => {
    if (modalState?.mode === 'edit' && payload.id) {
      updateIdentifier(payload.id, {
        type: payload.type,
        fields: payload.fields,
        notes: payload.notes,
        customIconId: payload.customIconId ?? null,
        color: payload.color ?? null,
        tags: payload.tags ?? [],
      });
    } else {
      const created = addIdentifier(payload);
      if (created) recordCreate(created);
    }
    closeModal();
  };

  const handleDelete = (event, id, label) => {
    event.stopPropagation();
    if (!confirm(`Delete "${label}"? You can press Ctrl+Z to restore.`)) return;
    const identifier = identifiers.find((i) => i.id === id);
    const relatedConnections = connections.filter((c) => c.source === id || c.target === id);
    const links = (project?.pinLinks ?? []).filter((l) => l.identifierId === id);
    deleteIdentifier(id);
    if (identifier) recordDelete(identifier, relatedConnections, links);
  };

  // ---- Copy / paste / duplicate and keyboard shortcuts ------------------------
  const selectedCanvasRecords = useCallback(
    () => identifiers.filter((i) => nodes.some((n) => n.selected && n.id === i.id)),
    [nodes, identifiers],
  );

  const handleCopySelected = useCallback(() => {
    const records = selectedCanvasRecords();
    if (records.length === 0) return false;
    setClipboard(records);
    return true;
  }, [selectedCanvasRecords, setClipboard]);

  const handlePaste = useCallback(() => {
    const records = getClipboard();
    if (!records || records.length === 0) return false;
    recordBatchCreate(bulkAddIdentifiers(cloneRecordsWithOffset(records)));
    return true;
  }, [getClipboard, bulkAddIdentifiers, recordBatchCreate]);

  const handleDuplicateSelected = useCallback(() => {
    const records = selectedCanvasRecords();
    if (records.length === 0) return false;
    recordBatchCreate(bulkAddIdentifiers(cloneRecordsWithOffset(records)));
    return true;
  }, [selectedCanvasRecords, bulkAddIdentifiers, recordBatchCreate]);

  useEffect(() => {
    const onKeyDown = (event) => {
      // Skip while typing or while a dialog/menu is open.
      const el = document.activeElement;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      if (modalState || menuState) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === 'z') {
        event.preventDefault();
        undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      } else if (key === 'c') {
        if (handleCopySelected()) event.preventDefault();
      } else if (key === 'v') {
        if (handlePaste()) event.preventDefault();
      } else if (key === 'd') {
        if (handleDuplicateSelected()) event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, handleCopySelected, handlePaste, handleDuplicateSelected, modalState, menuState]);

  const registerRow = (id, el) => {
    if (el) sidebarRowRefs.current.set(id, el);
    else sidebarRowRefs.current.delete(id);
  };

  const renderRow = (identifier, keyPrefix = '') => (
    <IdentifierRow
      key={`${keyPrefix}${identifier.id}`}
      identifier={identifier}
      focused={focusedIdentifierId === identifier.id}
      selected={bulk.selectedIds.has(identifier.id)}
      selectMode={bulk.selectMode}
      evidenceCount={evidenceCounts.get(identifier.id) ?? 0}
      registerRow={registerRow}
      onOpen={openEdit}
      onToggleSelected={bulk.toggle}
      onDelete={handleDelete}
      onShowEvidence={showEvidenceFor}
      onHover={setHoveredIdentifierId}
    />
  );

  return (
    <div className="info-tab">
      <aside className={`info-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <SidebarTitle
            title="Identifiers"
            count={identifiers.length}
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
          />
          <div className="sidebar-header-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="import-identifiers-button"
              title="Import identifiers (CSV) or saved views (JSON)"
              onClick={importer.openPicker}
            >
              Import
            </button>
            <button type="button" className="btn btn-primary btn-sm" data-testid="add-identifier-button" onClick={openAdd}>
              + Add
            </button>
            <input
              ref={importer.inputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              data-testid="identifier-csv-input"
              onChange={importer.onFile}
              hidden
            />
          </div>
        </div>

        {importer.status && (
          <div className={`import-status ${importer.status.tone}`} role="status">
            <span>{importer.status.message}</span>
            <button type="button" aria-label="Dismiss import message" onClick={importer.dismiss}>&times;</button>
          </div>
        )}

        <div className="identifier-search-wrap">
          <input
            type="search"
            className="identifier-search"
            placeholder="Search identifiers"
            value={filters.searchQuery}
            onChange={(event) => filters.setSearchQuery(event.target.value)}
            aria-label="Search identifiers"
          />
          {identifiers.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={bulk.selectMode}
              data-testid="select-mode-toggle"
              onClick={bulk.selectMode ? bulk.exit : bulk.enter}
            >
              {bulk.selectMode ? 'Done' : 'Select'}
            </button>
          )}
        </div>

        <LabelFilterBar
          tags={filters.allTags}
          colors={filters.usedColors}
          active={filters.activeLabelFilter}
          setFilter={filters.setLabelFilter}
          groupByTag={filters.groupByTag}
          onToggleGroup={() => filters.setGroupByTag((v) => !v)}
        />
        <PresetBar
          presets={filters.presets}
          filtersActive={filters.filtersActive}
          isActive={filters.isPresetActive}
          onApply={filters.applyPreset}
          onRemove={removeFilterPreset}
          draft={filters.presetDraft}
          setDraft={filters.setPresetDraft}
          onSave={filters.savePreset}
        />
        {bulk.selectMode && <BulkBar bulk={bulk} filtersActive={filters.filtersActive} />}

        <IdentifierList
          totalCount={identifiers.length}
          identifiers={filters.filteredIdentifiers}
          groupByTag={filters.groupByTag}
          collapsedGroups={filters.collapsedGroups}
          onToggleGroup={filters.toggleGroup}
          selectMode={bulk.selectMode}
          renderRow={renderRow}
        />

        <EvidencePanel
          panelRef={evidencePanelRef}
          focusIdentifier={evidenceFocusIdentifier}
          focusToken={evidenceFocus?.token}
          onClearFocus={() => setEvidenceFocus(null)}
        />
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
        <CanvasHints hasIdentifiers={identifiers.length > 0} />
      </div>

      {edgeEdit && (
        <EdgeLabelDialog
          edit={edgeEdit}
          onChange={(value) => setEdgeEdit({ ...edgeEdit, value })}
          onCancel={() => setEdgeEdit(null)}
          onSubmit={commitEdgeLabel}
        />
      )}
      {modalState && <IdentifierModal initial={modalState.initial} onClose={closeModal} onSubmit={handleSubmit} />}
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
