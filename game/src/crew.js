// crew.js — CREW ABILITY panel: 3 paid skills with cooldowns.
// Effects are REAL (applied by main.js): plates slow police recognition +
// drain heat, quick fix restores condition/armor, eyes out marks police on
// the minimap. This file only owns timers, costs and readiness state.
export const CREW_SKILLS = [
  {
    id: 'plates', key: 'Z', name: 'SWAP PLATES', cost: 150, cooldown: 60, duration: 30,
    desc: 'Plat disembunyikan — polisi lambat mengenali, wanted turun perlahan',
  },
  {
    id: 'fix', key: 'X', name: 'QUICK FIX', cost: 200, cooldown: 45, duration: 0,
    desc: 'Perbaiki bodi + armor secara instan',
  },
  {
    id: 'eyes', key: 'C', name: 'EYES OUT', cost: 100, cooldown: 30, duration: 10,
    desc: 'Spotter lapor posisi polisi, roadblock, heli di minimap',
  },
];

// flash message stays on the panel for this long (ms)
const MESSAGE_MS = 2600;

export class Crew {
  constructor() {
    // lastUsed starts at -Infinity ("never used"): performance.now() counts
    // from page load, so 0 would falsely read as "used at load" and lock
    // every skill behind a 45-60s cooldown for the first minute of play.
    this.lastUsed = [-Infinity, -Infinity, -Infinity];
    this.activeUntil = [0, 0, 0]; // ms until a duration effect ends (0 = not active)
    this.message = '';
    this.messageUntil = 0;
  }
  now() { return performance.now(); }
  // shared helpers: activeUntil[i] is a timestamp (0 = never active)
  isActive(i) { return this.now() < this.activeUntil[i]; }
  activeLeft(i) { return Math.max(0, (this.activeUntil[i] - this.now()) / 1000); }
  platesActive() { return this.isActive(0); }
  eyesActive() { return this.isActive(2); }
  platesLeft() { return this.activeLeft(0); }
  eyesLeft() { return this.activeLeft(2); }
  cooldownLeft(i) {
    const left = (this.lastUsed[i] + CREW_SKILLS[i].cooldown * 1000 - this.now()) / 1000;
    return Math.max(0, left);
  }
  // Checks money + cooldown. Deducting money and applying the effect is the caller's job.
  tryUse(i, money) {
    const s = CREW_SKILLS[i];
    const cd = this.cooldownLeft(i);
    if (cd > 0) return { ok: false, reason: `COOLDOWN ${Math.ceil(cd)}s` };
    if (money < s.cost) return { ok: false, reason: `NEED $${s.cost}` };
    this.lastUsed[i] = this.now();
    if (s.duration > 0) this.activeUntil[i] = this.now() + s.duration * 1000;
    return { ok: true, cost: s.cost };
  }
  flash(msg) { this.message = msg; this.messageUntil = this.now() + MESSAGE_MS; }
  // one place owns the panel status text + class for a skill (was an inline
  // if/else chain inside rows(), repeated for every skill row)
  skillStatus(i, money) {
    const cd = this.cooldownLeft(i);
    if (this.isActive(i)) return { status: `ON ${Math.ceil(this.activeLeft(i))}s`, cls: 'active' };
    if (cd > 0) return { status: `${Math.ceil(cd)}s`, cls: 'cooldown' };
    if (money < CREW_SKILLS[i].cost) return { status: 'NEED $', cls: 'need' };
    return { status: 'READY', cls: 'ready' };
  }
  rows(money) {
    return CREW_SKILLS.map((s, i) => {
      const cd = this.cooldownLeft(i);
      const active = this.isActive(i);
      const { status, cls } = this.skillStatus(i, money);
      return {
        ...s, index: i, ready: cd <= 0 && money >= s.cost,
        cooldownLeft: cd, active, activeLeft: active ? Math.ceil(this.activeLeft(i)) : 0, status, cls,
        msg: this.now() < this.messageUntil ? this.message : '',
      };
    });
  }
}
