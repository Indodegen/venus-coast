// save.js — auto-save / load via localStorage. One key, one JSON object.
// Saved after every completed mission (and after garage purchases) so the
// player keeps money, respect, weapons, paint and body upgrades.
export const SAVE_KEY = 'venus-coast-save-v1';
export const SAVE_VERSION = 1;

function isValidSave(s) {
  return !!(s && s.v === SAVE_VERSION);
}

// localStorage can throw (private mode / storage full) — one wrapper owns the
// try/catch for all three entry points instead of repeating it in each one.
function storageCall(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

export function loadSave() {
  const raw = storageCall(() => localStorage.getItem(SAVE_KEY), null);
  if (!raw) return null;
  const s = storageCall(() => JSON.parse(raw), null);
  return isValidSave(s) ? s : null;
}

export function writeSave(data) {
  return storageCall(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), ...data }));
    return true;
  }, false);
}

export function clearSave() {
  storageCall(() => localStorage.removeItem(SAVE_KEY));
}
