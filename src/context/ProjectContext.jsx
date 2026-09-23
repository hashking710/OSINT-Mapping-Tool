import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createProject } from '../utils/createProject.js';
import { downloadProject, readProjectFromFile } from '../utils/projectIO.js';
import {
  flushRecentsPersistence,
  saveRecent,
  markRecentSaved,
} from '../utils/recentProjects.js';
import { DEFAULT_PIN_COLOR } from '../pinColors.js';
import { reorderById } from '../utils/pinOrder.js';
import { describeMergeSummary } from '../utils/mergeSummary.js';
import { normalizeColor, normalizeTags } from '../utils/identifierLabels.js';

const ProjectContext = createContext(null);

const AUTOSAVE_DELAY_MS = 500;

export function ProjectProvider({ children }) {
  const [project, setProject] = useState(null);
  // updatedAt of the last file save/open; any later change makes the project "dirty".
  const [savedStamp, setSavedStamp] = useState(null);
  // Offer to undo the most recent merge: { snapshot, summary, stamp }.
  const [mergeUndo, setMergeUndo] = useState(null);
  const isDirty = !!project && project.updatedAt !== savedStamp;
  // Latest project state mirrored synchronously for flush-on-unmount paths
  // (e.g. closeProject) where setState wouldn't have applied yet.
  const projectRef = useRef(null);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    const flush = () => flushRecentsPersistence();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  // Debounced auto-snapshot of every change so the user can resume after
  // accidentally backing out. Snapshot is keyed by project.id; carries the
  // existing lastSavedAt across (saveRecent default).
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(() => saveRecent(project), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [project]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const newProject = (init) => {
    setMergeUndo(null);
    const created = createProject(init);
    setProject(created);
    setSavedStamp(created.updatedAt);
    // Immediate snapshot so the row appears in recents even before any edit.
    saveRecent(created, { lastSavedAt: null });
  };

  const openProjectFromFile = async (file) => {
    const loaded = await readProjectFromFile(file);
    setMergeUndo(null);
    setProject(loaded);
    setSavedStamp(loaded.updatedAt);
    // The file represents a saved state — mark the recent entry as saved.
    saveRecent(loaded, { lastSavedAt: new Date().toISOString() });
    return loaded;
  };

  // Resume a project from a stored recent snapshot (no file read).
  const openProjectFromSnapshot = (snapshot, { unsaved = false } = {}) => {
    if (!snapshot) return null;
    setMergeUndo(null);
    setProject(snapshot);
    setSavedStamp(unsaved ? null : snapshot.updatedAt);
    return snapshot;
  };

  const closeProject = () => {
    // Flush the latest state synchronously before unmounting so the auto-save
    // debounce can't race the user clicking Back.
    const current = projectRef.current;
    if (current) saveRecent(current);
    setMergeUndo(null);
    setProject(null);
  };

  // The undo offer lasts only until the next edit, so it can never wipe out
  // work done after the merge.
  useEffect(() => {
    if (!mergeUndo || !project) return;
    if (mergeUndo.stamp === null) {
      if (project.updatedAt !== mergeUndo.snapshot.updatedAt) {
        setMergeUndo((m) => (m ? { ...m, stamp: project.updatedAt } : m));
      }
    } else if (project.updatedAt !== mergeUndo.stamp) {
      setMergeUndo(null);
    }
  }, [project, mergeUndo]);

  const withMergeLog = (merged, summary, info) => {
    const { source = '', files = [], note = '' } = typeof info === 'string' ? { source: info } : (info ?? {});
    const total =
      Object.values(summary.added).reduce((n, v) => n + v, 0) +
      Object.values(summary.updated).reduce((n, v) => n + v, 0);
    const entry = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      source: String(source ?? '').slice(0, 120),
      text: note ? `${describeMergeSummary(summary)}; ${note}` : describeMergeSummary(summary),
      total,
      files: files.length > 1 ? files : [],
    };
    return { ...merged, mergeLog: [...(merged.mergeLog ?? []), entry].slice(-50) };
  };

  // Apply a merge to the open project (and remember how to undo it).
  const applyMerge = (merged, summary, info = '') => {
    if (!project) return;
    setMergeUndo({ snapshot: project, summary, stamp: null });
    updateProject(withMergeLog(merged, summary, info));
  };

  // Open the result of merging into a project that was not open (start screen).
  // It opens unsaved; the original file on disk is untouched.
  const openMergedProject = (base, merged, summary, info = '') => {
    const next = { ...withMergeLog(merged, summary, info), updatedAt: new Date().toISOString() };
    setProject(next);
    setSavedStamp(null);
    setMergeUndo({ snapshot: base, summary, stamp: null });
    return next;
  };

  const undoMerge = () => {
    if (!mergeUndo) return;
    updateProject(mergeUndo.snapshot);
    setMergeUndo(null);
  };

  const dismissMergeUndo = () => setMergeUndo(null);

  const saveProject = () => {
    if (!project) return;
    const stamped = downloadProject(project);
    setProject(stamped);
    setSavedStamp(stamped.updatedAt);
    // The downloaded file IS the saved state — flush + mark.
    saveRecent(stamped, { lastSavedAt: new Date().toISOString() });
    markRecentSaved(stamped.id);
  };

  const updateProject = (updater) => {
    setProject((current) => {
      if (!current) return current;
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...next, updatedAt: new Date().toISOString() };
    });
  };

  const addIdentifier = (identifier) => {
    const now = new Date().toISOString();
    let created;
    updateProject((p) => {
      const idx = p.identifiers.length;
      const defaultPosition = {
        x: 60 + (idx % 4) * 240,
        y: 60 + Math.floor(idx / 4) * 150,
      };
      created = {
        id: identifier.id ?? crypto.randomUUID(),
        type: identifier.type,
        fields: identifier.fields ?? {},
        notes: identifier.notes ?? '',
        position: identifier.position ?? defaultPosition,
        customIconId: identifier.customIconId ?? null,
        color: normalizeColor(identifier.color),
        tags: normalizeTags(identifier.tags),
        createdAt: now,
        updatedAt: now,
      };
      return { ...p, identifiers: [...p.identifiers, created] };
    });
    return created;
  };

  // Batched-add for paste / duplicate. Commits all records in one updateProject
  // so React only renders once and the action shows up as a single undo entry.
  const bulkAddIdentifiers = (records) => {
    if (!records || records.length === 0) return [];
    const now = new Date().toISOString();
    const built = [];
    updateProject((p) => {
      const startIdx = p.identifiers.length;
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const idx = startIdx + i;
        const defaultPosition = {
          x: 60 + (idx % 4) * 240,
          y: 60 + Math.floor(idx / 4) * 150,
        };
        built.push({
          id: r.id ?? crypto.randomUUID(),
          type: r.type,
          fields: r.fields ?? {},
          notes: r.notes ?? '',
          position: r.position ?? defaultPosition,
          customIconId: r.customIconId ?? null,
          color: normalizeColor(r.color),
          tags: normalizeTags(r.tags),
          createdAt: now,
          updatedAt: now,
        });
      }
      return { ...p, identifiers: [...p.identifiers, ...built] };
    });
    return built;
  };

  const updateIdentifier = (id, patch) => {
    updateProject((p) => ({
      ...p,
      identifiers: p.identifiers.map((it) =>
        it.id === id
          ? { ...it, ...patch, id: it.id, updatedAt: new Date().toISOString() }
          : it,
      ),
    }));
  };

  const deleteIdentifier = (id) => {
    updateProject((p) => ({
      ...p,
      identifiers: p.identifiers.filter((it) => it.id !== id),
      connections: p.connections.filter(
        (c) => c.source !== id && c.target !== id,
      ),
      pinLinks: (p.pinLinks ?? []).filter((l) => l.identifierId !== id),
    }));
  };

  const addConnection = (
    source,
    target,
    sourceHandle = null,
    targetHandle = null,
  ) => {
    if (!source || !target || source === target) return null;
    let created = null;
    updateProject((p) => {
      const exists = p.connections.some(
        (c) =>
          (c.source === source && c.target === target) ||
          (c.source === target && c.target === source),
      );
      if (exists) return p;
      created = {
        id: crypto.randomUUID(),
        source,
        target,
        sourceHandle: sourceHandle ?? null,
        targetHandle: targetHandle ?? null,
        label: '',
      };
      return { ...p, connections: [...p.connections, created] };
    });
    return created;
  };

  const deleteConnection = (id) => {
    updateProject((p) => ({
      ...p,
      connections: p.connections.filter((c) => c.id !== id),
    }));
  };

  const addPin = (pin) => {
    const now = new Date().toISOString();
    const record = {
      id: pin.id ?? crypto.randomUUID(),
      label: pin.label ?? '',
      address: pin.address ?? '',
      lat: pin.lat,
      lng: pin.lng,
      placeId: pin.placeId ?? null,
      visitedAt: pin.visitedAt ?? '',
      withWho: pin.withWho ?? '',
      notes: pin.notes ?? '',
      color: pin.color ?? DEFAULT_PIN_COLOR,
      iconId: pin.iconId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    updateProject((p) => ({ ...p, locations: [...p.locations, record] }));
    return record;
  };

  const reorderPins = (fromId, toId) => {
    updateProject((p) => {
      const locations = reorderById(p.locations, fromId, toId);
      return locations === p.locations ? p : { ...p, locations };
    });
  };

  const updatePin = (id, patch) => {
    updateProject((p) => ({
      ...p,
      locations: p.locations.map((it) =>
        it.id === id
          ? { ...it, ...patch, id: it.id, updatedAt: new Date().toISOString() }
          : it,
      ),
    }));
  };

  const deletePin = (id) => {
    updateProject((p) => ({
      ...p,
      locations: p.locations.filter((it) => it.id !== id),
      pinLinks: (p.pinLinks ?? []).filter((l) => l.pinId !== id),
    }));
  };

  const addPinLink = (pinId, identifierId, context = '') => {
    if (!pinId || !identifierId) return null;
    let created = null;
    updateProject((p) => {
      const existing = (p.pinLinks ?? []).find(
        (l) => l.pinId === pinId && l.identifierId === identifierId,
      );
      if (existing) {
        created = existing;
        return p;
      }
      created = {
        id: crypto.randomUUID(),
        pinId,
        identifierId,
        context,
        createdAt: new Date().toISOString(),
      };
      return { ...p, pinLinks: [...(p.pinLinks ?? []), created] };
    });
    return created;
  };

  const updateConnection = (connectionId, patch) => {
    updateProject((p) => ({
      ...p,
      connections: p.connections.map((c) => (c.id === connectionId ? { ...c, ...patch } : c)),
    }));
  };

  const addFilterPreset = ({ name, query = '', tag = null, color = null }) => {
    const clean = String(name ?? '').trim().slice(0, 40);
    if (!clean) return;
    updateProject((p) => {
      const others = (p.filterPresets ?? []).filter((preset) => preset.name.toLowerCase() !== clean.toLowerCase());
      return {
        ...p,
        filterPresets: [...others, { id: crypto.randomUUID(), name: clean, query, tag, color }],
      };
    });
  };

  // Merge saved views (from an import); a view with the same name is replaced.
  // Returns how many existing views were replaced.
  const addFilterPresets = (views) => {
    let replaced = 0;
    updateProject((p) => {
      const incoming = new Map(views.map((v) => [v.name.toLowerCase(), v]));
      const kept = (p.filterPresets ?? []).filter((preset) => {
        const clash = incoming.has(preset.name.toLowerCase());
        if (clash) replaced += 1;
        return !clash;
      });
      const added = views.map((v) => ({
        id: crypto.randomUUID(),
        name: v.name,
        query: v.query ?? '',
        tag: v.tag ?? null,
        color: v.color ?? null,
      }));
      return { ...p, filterPresets: [...kept, ...added] };
    });
    return replaced;
  };

  const removeFilterPreset = (presetId) => {
    updateProject((p) => ({
      ...p,
      filterPresets: (p.filterPresets ?? []).filter((preset) => preset.id !== presetId),
    }));
  };

  const addEvidenceEntry = (entry) => {
    if (!entry || !entry.title || !entry.text) return null;
    let created = null;
    updateProject((p) => {
      created = {
        id: entry.id ?? crypto.randomUUID(),
        title: entry.title,
        subtitle: entry.subtitle ?? '',
        text: entry.text,
        source: entry.source ?? 'Public source',
        sourceUrl: entry.sourceUrl ?? '',
        context: entry.context ?? '',
        createdAt: entry.createdAt ?? new Date().toISOString(),
      };
      return {
        ...p,
        evidence: [...(p.evidence ?? []), created],
      };
    });
    return created;
  };

  const removeEvidenceEntry = (entryId) => {
    updateProject((p) => ({
      ...p,
      evidence: (p.evidence ?? []).filter((entry) => entry.id !== entryId),
    }));
  };

  const updateMapDisplay = (patch) => {
    updateProject((p) => ({
      ...p,
      mapDisplay: {
        showPinConnections: false,
        pinConnectionColor: '#ef4444',
        ...(p.mapDisplay ?? {}),
        ...patch,
      },
    }));
  };

  const setPinLinkContext = (pinId, identifierId, context) => {
    updateProject((p) => ({
      ...p,
      pinLinks: (p.pinLinks ?? []).map((l) =>
        l.pinId === pinId && l.identifierId === identifierId
          ? { ...l, context }
          : l,
      ),
    }));
  };

  const removePinLink = (linkId) => {
    if (!linkId) return;
    updateProject((p) => ({
      ...p,
      pinLinks: (p.pinLinks ?? []).filter((l) => l.id !== linkId),
    }));
  };

  const removePinLinkByPair = (pinId, identifierId) => {
    updateProject((p) => ({
      ...p,
      pinLinks: (p.pinLinks ?? []).filter(
        (l) => !(l.pinId === pinId && l.identifierId === identifierId),
      ),
    }));
  };

  return (
    <ProjectContext.Provider
      value={{
        project,
        isDirty,
        mergeUndo,
        applyMerge,
        openMergedProject,
        undoMerge,
        dismissMergeUndo,
        newProject,
        openProjectFromFile,
        openProjectFromSnapshot,
        closeProject,
        saveProject,
        updateProject,
        addIdentifier,
        bulkAddIdentifiers,
        updateIdentifier,
        deleteIdentifier,
        addConnection,
        deleteConnection,
        updateConnection,
        addPin,
        updatePin,
        reorderPins,
        deletePin,
        addPinLink,
        removePinLink,
        removePinLinkByPair,
        setPinLinkContext,
        addFilterPreset,
        addFilterPresets,
        removeFilterPreset,
        addEvidenceEntry,
        removeEvidenceEntry,
        updateMapDisplay,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
