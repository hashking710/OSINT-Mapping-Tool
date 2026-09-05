/**
 * Custom icon library stored in localStorage. Browser-scoped so the user can
 * reuse uploaded icons across all of their projects.
 *
 * Shape:
 *   { [iconId]: { name: string, dataUrl: string } }
 *
 * iconIds are namespaced with the "custom-" prefix so they never collide with
 * the built-in icon keys (instagram, snapchat, …) used in BUILT_IN_ICONS.
 */

export function sanitizeSvgText(svgText) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    throw new Error('SVG sanitization is unavailable in this browser.');
  }
  const document = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (document.querySelector('parsererror') || !document.documentElement) {
    throw new Error('The SVG file is not valid.');
  }

  for (const element of document.querySelectorAll(
    'script, foreignObject, iframe, object, embed, link, style, metadata',
  )) {
    element.remove();
  }
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith('on') ||
        /^(href|src|xlink:href)$/.test(name) && !value.startsWith('#') ||
        /(?:url\s*\(|javascript:|data:)/i.test(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return new XMLSerializer().serializeToString(document.documentElement);
}

const STORAGE_KEY = 'osint-tool:custom-icons';
const DB_NAME = 'osint-tool';
const DB_STORE = 'custom-icons';
const DB_KEY = 'library';

export const MAX_ICON_BYTES = 300 * 1024; // 300KB cap to keep localStorage healthy

let pendingIcons = null;
let pendingHandle = null;

function indexedDbAvailable() {
  return typeof indexedDB !== 'undefined';
}

function openIconsDatabase() {
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

export function loadCustomIcons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function persistCustomIcons(icons) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(icons));
    return true;
  } catch {
    // Likely QuotaExceededError. Caller should surface a friendly message.
    return false;
  }
}

export async function loadCustomIconsAsync() {
  if (!indexedDbAvailable()) return loadCustomIcons();
  try {
    const db = await openIconsDatabase();
    const stored = await new Promise((resolve, reject) => {
      const request = db
        .transaction(DB_STORE, 'readonly')
        .objectStore(DB_STORE)
        .get(DB_KEY);
      request.onsuccess = () => resolve(request.result?.icons ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (stored) return stored;

    const legacy = loadCustomIcons();
    if (Object.keys(legacy).length > 0) await persistCustomIconsAsync(legacy);
    return legacy;
  } catch {
    return loadCustomIcons();
  }
}

export async function persistCustomIconsAsync(icons) {
  if (!indexedDbAvailable()) return persistCustomIcons(icons);
  try {
    const db = await openIconsDatabase();
    await new Promise((resolve, reject) => {
      const request = db
        .transaction(DB_STORE, 'readwrite')
        .objectStore(DB_STORE)
        .put({ icons }, DB_KEY);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    db.close();
    return true;
  } catch {
    return persistCustomIcons(icons);
  }
}

function flushScheduledCustomIcons() {
  pendingHandle = null;
  if (!pendingIcons) return;
  const icons = pendingIcons;
  pendingIcons = null;
  void persistCustomIconsAsync(icons);
}

export function scheduleCustomIconsPersistence(icons) {
  pendingIcons = icons;
  if (pendingHandle !== null) return;

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    pendingHandle = window.requestIdleCallback(flushScheduledCustomIcons, {
      timeout: 1000,
    });
  } else {
    pendingHandle = setTimeout(flushScheduledCustomIcons, 0);
  }
}

export function flushCustomIconsPersistence() {
  if (pendingHandle !== null && typeof window !== 'undefined') {
    if ('cancelIdleCallback' in window) window.cancelIdleCallback(pendingHandle);
    else clearTimeout(pendingHandle);
  }
  flushScheduledCustomIcons();
}

export async function clearStoredCustomIcons() {
  pendingIcons = null;
  if (pendingHandle !== null && typeof window !== 'undefined') {
    if ('cancelIdleCallback' in window) window.cancelIdleCallback(pendingHandle);
    else clearTimeout(pendingHandle);
    pendingHandle = null;
  }
  try {
    const db = await openIconsDatabase();
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

export function newCustomIconId() {
  return `custom-${crypto.randomUUID()}`;
}
