// garage.js — BAY AUTO garage: paint colors + body armor upgrades for the REDFIRE V8.
// Data only; the overlay UI lives in index.html and the wiring in main.js.
export const GARAGE_COLORS = [
  { name: 'VENUS RED', hex: 0xe8321e, css: '#e8321e' },
  { name: 'SUNSET GOLD', hex: 0xffd23f, css: '#ffd23f' },
  { name: 'OCEAN BLUE', hex: 0x2a6bff, css: '#2a6bff' },
  { name: 'PALM TEAL', hex: 0x2ec4b6, css: '#2ec4b6' },
  { name: 'NEON PURPLE', hex: 0xc77dff, css: '#c77dff' },
  { name: 'ARCTIC WHITE', hex: 0xf2f2f2, css: '#f2f2f2' },
];
export const PAINT_COST = 100;

// Body armor levels: higher max condition + higher max armor + damage reduction.
export const BODY_LEVELS = [
  { level: 0, cost: 0, maxCondition: 100, armorMax: 80, reduction: 0 },
  { level: 1, cost: 500, maxCondition: 125, armorMax: 90, reduction: 0.15 },
  { level: 2, cost: 1000, maxCondition: 150, armorMax: 100, reduction: 0.30 },
  { level: 3, cost: 2000, maxCondition: 175, armorMax: 110, reduction: 0.45 },
];
export const MAX_BODY_LEVEL = BODY_LEVELS.length - 1;

// one place owns the level clamp (bodyStats clamped it, nextBodyLevel did
// not — a save with an out-of-range level would read BODY_LEVELS[level + 1]
// as undefined). Both lookups go through here now.
function clampBodyLevel(level) {
  return Math.max(0, Math.min(MAX_BODY_LEVEL, level || 0));
}

export function bodyStats(level) {
  return BODY_LEVELS[clampBodyLevel(level)];
}
export function nextBodyLevel(level) {
  const cur = clampBodyLevel(level);
  return cur >= MAX_BODY_LEVEL ? null : BODY_LEVELS[cur + 1];
}
