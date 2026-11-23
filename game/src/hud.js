// hud.js — updates every locked HUD panel + circular minimap.
// Layout is fixed by the skill lock; this file only writes values, never moves panels.
import { RESPECT_NAMES } from './missions.js';

const $ = (id) => document.getElementById(id);
const MAX_STARS = 5;
// status-bar fill as a percentage, clamped to 100
const barPct = (value, max) => Math.min(100, (value / max) * 100);
// one place owns a vehicle status bar: fill width + number label (was the
// same two lines repeated for condition / armor / health in update())
const setBar = (fillId, numId, pct, label) => {
  $(fillId).style.width = `${pct}%`;
  $(numId).textContent = label;
};
const STREETS = [-160, -80, 0, 80, 160];

export class HUD {
  constructor() {
    this.map = $('minimap');
    this.mctx = this.map.getContext('2d');
    this.ammo = { pistol: [12, 48], smg: [30, 90] };
    this.weapon = 0;
  }

  setWeapon(i) {
    this.weapon = i;
    document.querySelectorAll('#weapons .slot').forEach((el, j) => {
      el.classList.toggle('active', j === i);
    });
  }
  setAmmo(kind, mag, reserve) {
    this.ammo[kind] = [mag, reserve];
    const slots = document.querySelectorAll('#weapons .slot');
    if (slots[2]) slots[2].querySelector('.ammo').textContent = `${mag} / ${reserve}`;
    if (kind === 'smg' && slots[3]) slots[3].querySelector('.ammo').textContent = `${mag} / ${reserve}`;
  }

  // CREW ABILITY panel (right side, below the weapon slots) — values only,
  // the panel position is fixed in index.html and never moves.
  updateCrew(rows) {
    if (!rows) return;
    const els = document.querySelectorAll('#crew .skill');
    rows.forEach((r, i) => {
      const el = els[i];
      if (!el) return;
      for (const cls of ['ready', 'cooldown', 'need', 'active']) el.classList.toggle(cls, r.cls === cls);
      const st = el.querySelector('.status');
      if (st) st.textContent = r.status;
    });
    const msgEl = document.getElementById('crew-msg');
    if (msgEl) msgEl.textContent = rows[0] ? rows[0].msg || '' : '';
  }

  update(s) {
    // mission objective (top-left)
    $('obj-tag').textContent = s.mission.tag;
    $('obj-name').textContent = s.mission.objective;
    $('obj-stage').textContent = `STAGE ${s.stage + 1}/${s.mission.stages.length}`;
    const t = Math.max(0, Math.ceil(s.timeLeft));
    $('obj-timer').textContent = `⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const next = s.mission.stages[Math.min(s.stage + 1, s.mission.stages.length - 1)];
    $('obj-next').textContent = s.stage + 1 >= s.mission.stages.length
      ? 'NEXT: Job complete — nice driving'
      : `NEXT: ${next.label}`;
    // dispatch (middle-left) — format [UNIT] | [dist m] | [ACTION]
    $('dispatch-count').textContent = `${s.dispatch.length} UNITS`;
    $('dispatch-rows').innerHTML = s.dispatch.map(r =>
      `<div class="row"><span class="unit">${r.name}</span><span class="dist">${r.dist}m</span><span class="act ${r.action}">${r.action}</span></div>`
    ).join('');
    // wanted + money (top-right)
    let stars = '';
    for (let i = 0; i < MAX_STARS; i++) stars += i < s.wanted ? '★' : '<span class="off">★</span>';
    $('wanted-stars').innerHTML = stars;
    $('money').textContent = '$' + s.money.toLocaleString('en-US');
    const lv = Math.min(5, 1 + Math.floor(s.respect / 100));
    $('respect').textContent = `RESPECT LV ${lv} · ${RESPECT_NAMES[lv - 1]}`;
    // vehicle (bottom-right) — bar widths are fractions of the upgraded maxima
    $('speed').textContent = Math.round(Math.abs(s.speedKmh));
    const mc = s.maxCondition || 100, am = s.armorMax || 80;
    setBar('cond-fill', 'cond-num', barPct(s.condition, mc), `${Math.round(s.condition)}%`);
    setBar('armor-fill', 'armor-num', barPct(s.armor, am), Math.round(s.armor));
    setBar('health-fill', 'health-num', s.health, Math.round(s.health));
    $('radio').textContent = `♪ ${s.radio}`;
    // dialog (bottom-center) — text + fixer name/avatar; panel position never changes
    if (s.dialogText) $('dialog-text').textContent = s.dialogText;
    if (s.fixer) {
      $('dialog-who').textContent = `${s.fixer.name.toUpperCase()} — FIXER`;
      $('dialog-avatar').textContent = s.fixer.initial;
    }
    if (s.crew) this.updateCrew(s.crew);
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const c = this.mctx, W = 190, R = 95;
    c.clearRect(0, 0, W, W);
    const scale = W / 520; // world -260..260 -> canvas
    const toMap = (x, z) => [W / 2 + x * scale, W / 2 + z * scale];
    // one place owns a straight map stroke (roads, bridge, pier all drew the
    // same beginPath/moveTo/lineTo/stroke sequence inline)
    const strokeSegment = (x1, z1, x2, z2) => {
      const [ax, ay] = toMap(x1, z1); const [bx, by] = toMap(x2, z2);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    };
    // clip to circle
    c.save();
    c.beginPath(); c.arc(W / 2, W / 2, R - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#0d1530'; c.fillRect(0, 0, W, W);
    // ocean + beach
    c.fillStyle = '#1e7fc4';
    c.fillRect(0, W / 2 + 150 * scale, W, W);
    c.fillStyle = '#e8d29a';
    c.fillRect(0, W / 2 + 150 * scale - 6, W, 6);
    // channel
    c.fillStyle = '#1e7fc4';
    c.fillRect(W / 2 + 100 * scale, 0, 45 * scale, W);
    // roads
    c.strokeStyle = '#8a8f9c'; c.lineWidth = 5;
    for (const v of STREETS) {
      strokeSegment(v, -230, v, 230);
      strokeSegment(-230, v, 230, v);
    }
    // bridge
    c.strokeStyle = '#ffd23f'; c.lineWidth = 4;
    strokeSegment(78, 30, 167, 30);
    // pier
    c.strokeStyle = '#c9a06a'; c.lineWidth = 4;
    strokeSegment(0, 168, 0, 258);
    // checkpoint marker (pulsing yellow diamond)
    if (s.checkpoint) {
      const [cx, cy] = toMap(s.checkpoint.x, s.checkpoint.z);
      const p = 1 + 0.25 * Math.sin(Date.now() / 180);
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.moveTo(cx, cy - 8 * p); c.lineTo(cx + 7 * p, cy); c.lineTo(cx, cy + 8 * p); c.lineTo(cx - 7 * p, cy);
      c.closePath(); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    }
    // police dots (gold ring while EYES OUT is active — the spotter marks them)
    for (const p of s.police) {
      const [x, y] = toMap(p.x, p.z);
      c.fillStyle = p.kind === 'heli' ? '#ff5fa2' : '#57b6ff';
      c.beginPath(); c.arc(x, y, p.kind === 'heli' ? 5 : 3.5, 0, Math.PI * 2); c.fill();
      if (s.eyesOut) {
        c.strokeStyle = '#ffd23f'; c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, p.kind === 'heli' ? 9 : 7, 0, Math.PI * 2); c.stroke();
      }
    }
    // player arrow (center-ish, white triangle pointing along heading)
    const [px, py] = toMap(s.playerX, s.playerZ);
    c.save(); c.translate(px, py); c.rotate(-s.heading);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.strokeStyle = '#e8321e'; c.lineWidth = 1.5; c.stroke();
    c.restore();
    c.restore();
    // ring
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
    c.beginPath(); c.arc(W / 2, W / 2, R - 2, 0, Math.PI * 2); c.stroke();
  }
}
