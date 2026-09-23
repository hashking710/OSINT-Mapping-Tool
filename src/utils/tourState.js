const STORAGE_KEY = 'osint-tool:tour-seen';

export function hasSeenTour() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* storage unavailable: the tour may show again next visit */
  }
}
