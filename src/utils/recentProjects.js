/**
 * Recent-projects store (localStorage).
 *
 * Auto-snapshots the current project on every change so backing out via the
 * top-left arrow doesn't silently lose work. The Landing screen reads this
 * list and lets the user resume any of the last few projects.
 *
 * Shape:
 *   [
 *     {
 *       id: string,            // project.id — used for dedupe
 *       name: string,
 *       snapshot: object,      // full project state, serialisable
 *       snapshotAt: ISO,       // when this snapshot was written
 *       lastSavedAt: ISO|null  // when the user last clicked Save (or opened from file)
 *     },
 *     …
 *   ]
 *
 * Capped at MAX_RECENTS. Oldest dropped first. If localStorage fills up
 * (e.g. very large projects with embedded custom icons), we drop more
 * entries until the write succeeds.
 */

const STORAGE_KEY = 'osint-tool:recent-projects';
const DB_NAME = 'osint-tool';
const DB_STORE = 'recent-projects';
const DB_KEY = 'recents';
const MAX_RECENTS = 5;

function indexedDbAvailable() {
  return typeof indexedDB !== 'undefined';
}

function openRecentsDatabase() {
  return new Promise((resolve, reject) => {
    if (!indexedDbAvailable()) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function loadRecents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r) => r && r.snapshot) : [];
  } catch {
    return [];
  }
}

function writeRecents(list) {
  // Cap, then write synchronously only when IndexedDB is unavailable.
  let capped = list.slice(0, MAX_RECENTS);
  if (indexedDbAvailable()) {
    scheduleRecentsPersistence(capped);
    return capped;
  }
  while (capped.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
      return capped;
    } catch {
      capped = capped.slice(0, -1);
    }
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return [];
}

export async function loadRecentsAsync() {
  if (!indexedDbAvailable()) return loadRecents();
  try {
    const db = await openRecentsDatabase();
    const stored = await new Promise((resolve, reject) => {
      const request = db
        .transaction(DB_STORE, 'readonly')
        .objectStore(DB_STORE)
        .get(DB_KEY);
      request.onsuccess = () => resolve(request.result?.recents ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (Array.isArray(stored)) return stored;

    const legacy = loadRecents();
    if (legacy.length > 0) await persistRecentsAsync(legacy);
    return legacy;
  } catch {
    return loadRecents();
  }
}

async function persistRecentsAsync(recents) {
  if (!indexedDbAvailable()) return;
  try {
    const db = await openRecentsDatabase();
    await new Promise((resolve, reject) => {
      const request = db
        .transaction(DB_STORE, 'readwrite')
        .objectStore(DB_STORE)
        .put({ recents }, DB_KEY);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    // localStorage remains the fallback for browsers with a broken database.
    let capped = recents.slice(0, MAX_RECENTS);
    while (capped.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
        return;
      } catch {
        capped = capped.slice(0, -1);
      }
    }
  }
}

let pendingRecents = null;
let pendingHandle = null;

function flushScheduledRecents() {
  pendingHandle = null;
  if (!pendingRecents) return;
  const recents = pendingRecents;
  pendingRecents = null;
  void persistRecentsAsync(recents);
}

function scheduleRecentsPersistence(recents) {
  pendingRecents = recents;
  if (pendingHandle !== null) return;
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    pendingHandle = window.requestIdleCallback(flushScheduledRecents, {
      timeout: 1000,
    });
  } else {
    pendingHandle = setTimeout(flushScheduledRecents, 0);
  }
}

export function flushRecentsPersistence() {
  if (pendingHandle !== null && typeof window !== 'undefined') {
    if ('cancelIdleCallback' in window) window.cancelIdleCallback(pendingHandle);
    else clearTimeout(pendingHandle);
  }
  flushScheduledRecents();
}

export async function clearStoredRecents() {
  pendingRecents = null;
  if (pendingHandle !== null && typeof window !== 'undefined') {
    if ('cancelIdleCallback' in window) window.cancelIdleCallback(pendingHandle);
    else clearTimeout(pendingHandle);
    pendingHandle = null;
  }
  try {
    const db = await openRecentsDatabase();
    await new Promise((resolve, reject) => {
      const request = db
        .transaction(DB_STORE, 'readwrite')
        .objectStore(DB_STORE)
        .delete(DB_KEY);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {}
}

/**
 * Upsert a project snapshot. Carries over the previous `lastSavedAt` if not
 * specified explicitly so a pure auto-snapshot doesn't clear the saved-marker.
 */
export function saveRecent(snapshot, { lastSavedAt } = {}) {
  if (!snapshot || !snapshot.id) return loadRecents();
  const recents = loadRecents();
  const idx = recents.findIndex((r) => r.id === snapshot.id);
  const previous = idx >= 0 ? recents[idx] : null;
  const entry = {
    id: snapshot.id,
    name: snapshot.name ?? 'Untitled Project',
    snapshot,
    snapshotAt: new Date().toISOString(),
    lastSavedAt:
      lastSavedAt !== undefined ? lastSavedAt : previous?.lastSavedAt ?? null,
  };
  const rest =
    idx >= 0
      ? [...recents.slice(0, idx), ...recents.slice(idx + 1)]
      : recents;
  return writeRecents([entry, ...rest]);
}

/** Update only the lastSavedAt timestamp (called after Save / Open). */
export function markRecentSaved(projectId, savedAt = new Date().toISOString()) {
  if (!projectId) return loadRecents();
  const recents = loadRecents();
  const idx = recents.findIndex((r) => r.id === projectId);
  if (idx < 0) return recents;
  const next = [...recents];
  next[idx] = { ...next[idx], lastSavedAt: savedAt };
  return writeRecents(next);
}

export function removeRecent(projectId) {
  const next = loadRecents().filter((r) => r.id !== projectId);
  return writeRecents(next);
}

export function hasUnsavedChanges(entry) {
  if (!entry) return false;
  if (!entry.lastSavedAt) return true;
  // Compare against the project's own updatedAt (which only advances on real
  // edits) rather than snapshotAt (which advances on every auto-snapshot,
  // even when nothing changed — those would erroneously read as "unsaved").
  const projectUpdated =
    entry.snapshot?.updatedAt ?? entry.snapshotAt ?? null;
  if (!projectUpdated) return false;
  return new Date(projectUpdated).getTime() >
    new Date(entry.lastSavedAt).getTime();
}
