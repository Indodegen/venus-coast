// main.js — VENUS COAST game: loop, arcade driving, mission flow, weapons, camera.
// All code written fresh in this session. Debug API: window.__game (used by the test harness).
import * as THREE from 'three';
import { buildWorld, WORLD, GARAGE_ZONE } from './world.js';
import { makeMuscleCar, repaintCar } from './vehicles.js';
import { PoliceManager } from './police.js';
import { MISSIONS, RADIO, RESPECT_NAMES } from './missions.js';
import { HUD } from './hud.js';
import { stageShot, stageGarage } from './shots.js';
import { Crew } from './crew.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { GARAGE_COLORS, PAINT_COST, bodyStats, nextBodyLevel } from './garage.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
const world = buildWorld(scene);
const hud = new HUD();
const police = new PoliceManager(scene);

// ---- ground height: bridge ramps/deck + pier deck ----
export function groundY(x, z) {
  if (z >= 20 && z <= 40) {
    if (x >= 78 && x <= 167) return 6.6;                 // bridge deck
    if (x > 50 && x < 78) return 6.6 * (x - 50) / 28;     // west ramp
    if (x > 167 && x < 195) return 6.6 * (195 - x) / 28;  // east ramp
  }
  if (Math.abs(x) <= 6.5 && z >= 166 && z <= 260) return 1.5; // pier deck
  return 0;
}

// ---- player ----
const car = makeMuscleCar(0xe8321e);
scene.add(car);
const player = {
  x: 0, z: -40, y: 0, heading: 0, speed: 0,
  condition: 100, armor: 80, health: 100, lastHit: -9,
};
let money = 1250, respect = 0, weapon = 0;
let ammo = { pistol: [12, 48], smg: [30, 90] };
let firing = false, fireQueued = false, fireCooldown = 0;
// ---- garage + crew (UPDATE fitur baru — additive, tidak mengubah state lama) ----
let carColor = 0xe8321e, bodyLevel = 0;
const crew = new Crew();
let garageOpen = false, garageFromTitle = false, inGarageZone = false;
const maxCondition = () => bodyStats(bodyLevel).maxCondition;
const armorMax = () => bodyStats(bodyLevel).armorMax;
const damageReduction = () => bodyStats(bodyLevel).reduction;

// ---- checkpoint marker (ring + beam) ----
const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
const markerRing = new THREE.Mesh(new THREE.RingGeometry(4.5, 6, 32), markerMat);
markerRing.rotation.x = -Math.PI / 2; markerRing.position.y = 0.3;
scene.add(markerRing);
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
const markerBeam = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 42, 20, 1, true), beamMat);
markerBeam.position.y = 21; scene.add(markerBeam);
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe95a });
let tracer = null;

// ---- game state ----
let missionIndex = 0, stage = 0, timeLeft = 180, started = false, paused = false;
let allDone = false, failedAt = 0, bannerUntil = 0, shotMode = false, transitioning = false;
let shotDrive = false; // driving-shot mode: car really cruises at 100 km/h while the staged camera tracks it
const CRUISE_KMH = 100;
const shotCamOffset = new THREE.Vector3();
const shotLookOffset = new THREE.Vector3();
let heat = 40, wantedLevel = 2, nearShown = {}, dialogLog = [];
function setDialog(text) {
  if (text === dialogText) return;
  dialogText = text;
  dialogLog.push({ t: +(performance.now() / 1000).toFixed(1), text });
}
let keys = {};
let dialogText = MISSIONS[0].dialog;

function currentMission() { return MISSIONS[missionIndex]; }
function currentCheckpoint() {
  const m = currentMission();
  return m.stages[Math.min(stage, m.stages.length - 1)];
}

function startMission(i) {
  missionIndex = i;
  const m = currentMission();
  stage = 0; timeLeft = m.timer; allDone = false; failedAt = 0; transitioning = false;
  heat = 40; wantedLevel = m.wanted; nearShown = {};
  world.setTimeOfDay(m.timeOfDay);
  player.x = m.start.x; player.z = m.start.z; player.heading = m.start.heading;
  player.speed = 0; player.condition = maxCondition(); player.armor = armorMax(); player.health = 100;
  player.y = groundY(player.x, player.z);
  setDialog(m.stages[0].dialog || m.dialog);
  police.spawn(m, { x: player.x, z: player.z });
  hud.setWeapon(weapon);
  document.getElementById('mission-complete').style.display = 'none';
  placeMarker();
}
function placeMarker() {
  const cp = currentCheckpoint();
  markerRing.position.set(cp.x, groundY(cp.x, cp.z) + 0.3, cp.z);
  markerBeam.position.set(cp.x, groundY(cp.x, cp.z) + 21, cp.z);
}
function showBanner(title, text, ms = 3000) {
  const el = document.getElementById('mission-complete');
  document.getElementById('mc-title').textContent = title;
  document.getElementById('mc-text').textContent = text;
  el.style.display = 'block';
  bannerUntil = performance.now() + ms;
}
function completeStage() {
  if (transitioning) return;
  stage++;
  const m = currentMission();
  if (stage >= m.stages.length) {
    transitioning = true;
    money += m.reward; respect += 100;
    setDialog(`Job done — $${m.reward.toLocaleString()} in the pocket. ${m.fixer.name} is pleased.`);
    if (missionIndex + 1 >= MISSIONS.length) {
      allDone = true;
      showBanner('ALL 4 JOBS DONE', `VENUS COAST complete — $${money.toLocaleString()} total. Respect LV ${1 + Math.floor(respect / 100)} · ${RESPECT_NAMES[Math.min(4, Math.floor(respect / 100))]}`, 6000);
    } else {
      showBanner('JOB COMPLETE', `${m.name} — +$${m.reward.toLocaleString()} · next job loading…`);
      const next = missionIndex + 1; // capture now — missionIndex may change before the timer fires
      setTimeout(() => { if (started) startMission(next); }, 2600);
      stage = m.stages.length - 1; // hold marker until switch
    }
    saveGame(); // AUTO SAVE after every completed mission (allDone set above, so the final save records ALL JOBS DONE)
  } else {
    setDialog(m.stages[stage].dialog || m.dialog);
    placeMarker();
  }
}
function failMission(reason) {
  if (transitioning) return;
  transitioning = true;
  showBanner('JOB FAILED', reason + ' — restarting the job…');
  const cur = missionIndex; // capture now — missionIndex may change before the timer fires
  setTimeout(() => { if (started) startMission(cur); }, 2600);
}

// ---- SAVE / LOAD (auto-save after each mission + after garage purchases) ----
function saveGame() {
  const next = allDone ? 0 : Math.min(missionIndex + 1, MISSIONS.length - 1);
  writeSave({
    nextMission: next, allDone, money, respect, weapon, ammo,
    carColor, bodyLevel, x: player.x, z: player.z, heading: player.heading,
  });
  refreshTitleMenu();
}
function applySave(s) {
  money = s.money ?? 1250; respect = s.respect ?? 0;
  weapon = s.weapon ?? 0; ammo = s.ammo ?? { pistol: [12, 48], smg: [30, 90] };
  carColor = s.carColor ?? 0xe8321e; bodyLevel = s.bodyLevel ?? 0;
  repaintCar(car, carColor);
  hud.setWeapon(weapon);
  hud.setAmmo('pistol', ammo.pistol[0], ammo.pistol[1]);
  hud.setAmmo('smg', ammo.smg[0], ammo.smg[1]);
}

// ---- CREW ABILITIES (Z / X / C or click the panel rows) ----
function useCrew(i) {
  const res = crew.tryUse(i, money);
  if (!res.ok) { crew.flash(res.reason); return res; }
  money -= res.cost;
  if (i === 1) { // QUICK FIX — instant body + armor restore (real numbers)
    player.condition = maxCondition();
    player.armor = armorMax();
    crew.flash('BODY RESTORED');
  } else if (i === 0) {
    crew.flash('LOW PROFILE 30s');
  } else {
    crew.flash('POLICE MARKED 10s');
  }
  return { ok: true, cost: res.cost };
}

// garage paint lookup shared by the garage overlay, buyPaint and the title save line
const colorByHex = (hex) => GARAGE_COLORS.find((c) => c.hex === hex);

// ---- GARAGE (BAY AUTO) ----
function refreshGarageUI() {
  document.getElementById('garage-money').textContent = '$' + money.toLocaleString('en-US');
  const cur = colorByHex(carColor) || GARAGE_COLORS[0];
  document.getElementById('paint-name').textContent = cur.name + (carColor === cur.hex ? ' (ACTIVE)' : '');
  document.querySelectorAll('#paint-swatches .swatch').forEach((el) => {
    el.classList.toggle('selected', Number(el.dataset.hex) === carColor);
  });
  const stats = bodyStats(bodyLevel);
  document.getElementById('body-level').textContent = `LV ${bodyLevel}`;
  document.getElementById('body-info').textContent =
    `MAX CONDITION ${stats.maxCondition} · MAX ARMOR ${stats.armorMax} · DAMAGE -${Math.round(stats.reduction * 100)}%`;
  const next = nextBodyLevel(bodyLevel);
  const btn = document.getElementById('body-upgrade-btn');
  if (!next) { btn.textContent = 'BODY MAXED — LV 3'; btn.disabled = true; }
  else {
    btn.textContent = `UPGRADE → LV ${next.level} — $${next.cost.toLocaleString()}`;
    btn.disabled = money < next.cost;
  }
}
function buyPaint(hex) {
  if (hex === carColor) { garageMsg('ALREADY THIS COLOR'); return false; }
  if (money < PAINT_COST) { garageMsg(`NEED $${PAINT_COST} TO REPAINT`); return false; }
  money -= PAINT_COST; carColor = hex; repaintCar(car, hex);
  refreshGarageUI(); saveGame();
  garageMsg(`PAINTED ${colorByHex(hex)?.name || ''} — $${PAINT_COST}`);
  return true;
}
function buyUpgrade() {
  const next = nextBodyLevel(bodyLevel);
  if (!next) { garageMsg('BODY ALREADY MAXED'); return false; }
  if (money < next.cost) { garageMsg(`NEED $${next.cost.toLocaleString()}`); return false; }
  money -= next.cost; bodyLevel = next.level;
  player.condition = maxCondition(); player.armor = armorMax(); // upgrade repairs the car
  refreshGarageUI(); saveGame();
  garageMsg(`BODY LV ${bodyLevel} — MAX CONDITION ${next.maxCondition}`);
  return true;
}
function garageMsg(t) {
  const el = document.getElementById('garage-msg');
  if (el) el.textContent = t;
}
function openGarage(fromTitle = false) {
  garageOpen = true; garageFromTitle = fromTitle;
  paused = true;
  document.getElementById('garage-overlay').style.display = 'flex';
  document.getElementById('garage-prompt').style.display = 'none';
  refreshGarageUI();
}
function closeGarage() {
  garageOpen = false;
  document.getElementById('garage-overlay').style.display = 'none';
  if (garageFromTitle) {
    document.getElementById('title-screen').style.display = 'flex';
    paused = false;
  } else {
    paused = false;
  }
}

// ---- TITLE MENU ----
function refreshTitleMenu() {
  const s = loadSave();
  const btn = document.getElementById('continue-btn');
  const info = document.getElementById('save-info');
  if (s) {
    btn.disabled = false;
    btn.textContent = '▶ CONTINUE';
    const col = colorByHex(s.carColor);
    info.textContent = `SAVE: ${s.allDone ? 'ALL JOBS DONE' : 'JOB ' + (s.nextMission + 1) + '/4'} · $${(s.money ?? 0).toLocaleString()} · RESPECT ${s.respect ?? 0} · ${col ? col.name : 'VENUS RED'} · BODY LV ${s.bodyLevel ?? 0}`;
  } else {
    btn.disabled = true;
    btn.textContent = '▶ CONTINUE — NO SAVE YET';
    info.textContent = '';
  }
}
function newGame() {
  clearSave();
  money = 1250; respect = 0; weapon = 0;
  ammo = { pistol: [12, 48], smg: [30, 90] };
  carColor = 0xe8321e; bodyLevel = 0; repaintCar(car, carColor);
  document.getElementById('title-screen').style.display = 'none';
  started = true; startMission(0);
}
function continueGame() {
  const s = loadSave();
  if (!s) return false;
  applySave(s);
  document.getElementById('title-screen').style.display = 'none';
  started = true; startMission(s.nextMission ?? 0);
  return true;
}

// ---- input ----
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  // Digit1..Digit4 select weapons 0..3 (one rule instead of four identical ifs)
  if (e.code.startsWith('Digit')) {
    const d = parseInt(e.code.slice(5), 10);
    if (d >= 1 && d <= 4) { weapon = d - 1; hud.setWeapon(d - 1); }
  }
  if (e.code === 'KeyR') hud.setWeapon(weapon);
  if (e.code === 'KeyZ') useCrew(0); // SWAP PLATES
  if (e.code === 'KeyX') useCrew(1); // QUICK FIX
  if (e.code === 'KeyC') useCrew(2); // EYES OUT
  if (e.code === 'KeyG') {
    if (garageOpen) closeGarage();
    else if (started && inGarageZone) openGarage(false);
  }
  if (e.code === 'Escape' && garageOpen) closeGarage();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousedown', () => { firing = true; });
window.addEventListener('mouseup', () => { firing = false; });

function readInput() {
  // harness override (window.__game.input) takes precedence for automated driving
  const o = window.__game && window.__game.input;
  if (o) return { throttle: o.throttle || 0, steer: o.steer || 0, brake: !!o.brake, fire: !!o.fire };
  return {
    throttle: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 0.6 : 0),
    steer: (keys.KeyA || keys.ArrowLeft ? -1 : 0) + (keys.KeyD || keys.ArrowRight ? 1 : 0),
    brake: !!keys.Space,
    fire: firing,
  };
}

// ---- collision: circle vs building AABBs ----
function collideBuildings() {
  const r = 1.7;
  for (const b of world.colliders) {
    const cx = Math.max(b.minX, Math.min(player.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(player.z, b.maxZ));
    const dx = player.x - cx, dz = player.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.01;
      const nx = dx / d, nz = dz / d;
      player.x = cx + nx * r; player.z = cz + nz * r;
      const impact = Math.abs(player.speed);
      if (impact > 4 && performance.now() - player.lastHit > 600) {
        player.lastHit = performance.now();
        // body armor upgrade reduces condition damage (garage feature)
        const dmg = Math.min(14, impact * 0.5) * (1 - damageReduction());
        player.condition = Math.max(0, player.condition - dmg);
        player.armor = Math.max(0, player.armor - dmg * 0.5);
        if (player.armor <= 0) player.health = Math.max(0, player.health - dmg * 0.3);
      }
      player.speed *= 0.55;
    }
  }
  // world bounds
  player.x = Math.max(WORLD.minX + 4, Math.min(WORLD.maxX - 4, player.x));
  player.z = Math.max(WORLD.minZ + 4, Math.min(266, player.z));
  // ocean / channel water: push back (can't drive into deep water)
  // the waterline is at z=170 (south of the beach road + sand) — the old clamp
  // at z=152 shoved the car off the beach road onto the sidewalk
  if (player.z > 170 && Math.abs(player.x) > 8) {
    player.z = 170; player.speed *= 0.5;
  }
  if (player.x > WORLD.channelX0 && player.x < WORLD.channelX1 && !(player.z >= 20 && player.z <= 40)) {
    player.x = player.x < 122.5 ? WORLD.channelX0 : WORLD.channelX1; player.speed *= 0.5;
  }
}

// ---- weapons ----
// nearest police car within maxDist (minDot: only cars ahead of the player
// count when >= 0 — gunfire needs a target in front, melee hits anything close)
function nearestPolice(maxDist, minDot = -Infinity) {
  let best = null, bestD = maxDist;
  for (const c of police.cars) {
    const dx = c.group.position.x - player.x, dz = c.group.position.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d >= bestD) continue;
    const dot = (dx * Math.sin(player.heading) + dz * Math.cos(player.heading)) / (d || 1);
    if (dot <= minDot) continue;
    best = c; bestD = d;
  }
  return best;
}

function updateWeapons(dt) {
  fireCooldown -= dt;
  const wantFire = readInput().fire || fireQueued;
  if (!wantFire || fireCooldown > 0) return;
  fireQueued = false;
  if (weapon === 2 || weapon === 3) {
    const kind = weapon === 2 ? 'pistol' : 'smg';
    if (ammo[kind][0] <= 0) {
      if (ammo[kind][1] > 0) { ammo[kind] = [kind === 'pistol' ? 12 : 30, ammo[kind][1] - (kind === 'pistol' ? 12 : 30)]; }
      else return;
    }
    ammo[kind][0]--;
    hud.setAmmo(kind, ammo[kind][0], ammo[kind][1]);
    fireCooldown = kind === 'pistol' ? 0.28 : 0.1;
    // tracer from car nose forward 40m
    const fx = player.x + Math.sin(player.heading) * 2.6, fz = player.z + Math.cos(player.heading) * 2.6;
    const tx = fx + Math.sin(player.heading) * 42, tz = fz + Math.cos(player.heading) * 42;
    if (tracer) scene.remove(tracer);
    tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(fx, player.y + 1.2, fz), new THREE.Vector3(tx, player.y + 1.2, tz)]), tracerMat);
    scene.add(tracer);
    setTimeout(() => { if (tracer) { scene.remove(tracer); tracer = null; } }, 90);
    // nearest police car ahead within 45m slows down
    const best = nearestPolice(45, 0.6);
    if (best) best.speed = Math.max(4, best.speed * 0.45);
  } else {
    fireCooldown = 0.5; // fists / bat swing
    const best = nearestPolice(6);
    if (best) best.speed = Math.max(2, best.speed * 0.5);
  }
}

// ---- camera ----
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 6, -14);
function updateCamera(dt) {
  if (shotMode) {
    if (shotDrive) {
      // tracking camera: keep the exact staged framing relative to the moving car
      camera.position.set(player.x + shotCamOffset.x, player.y + shotCamOffset.y, player.z + shotCamOffset.z);
      camera.lookAt(player.x + shotLookOffset.x, player.y + shotLookOffset.y, player.z + shotLookOffset.z);
    }
    return; // staged camera is set by shots.js
  }
  const back = 10.5, height = 4.3;
  const tx = player.x - Math.sin(player.heading) * back;
  const tz = player.z - Math.cos(player.heading) * back;
  const ty = player.y + height;
  const k = Math.min(1, dt * 5);
  camPos.x += (tx - camPos.x) * k;
  camPos.y += (ty - camPos.y) * k;
  camPos.z += (tz - camPos.z) * k;
  camera.position.copy(camPos);
  camTarget.set(player.x + Math.sin(player.heading) * 8, player.y + 1.6, player.z + Math.cos(player.heading) * 8);
  camera.lookAt(camTarget);
}

// ---- main loop ----
// single source for the per-frame HUD snapshot (loop + staged shots all use it)
function hudSnapshot() {
  const m = currentMission();
  return {
    mission: m, stage, timeLeft, wanted: wantedLevel, money, respect,
    speedKmh: player.speed * 3.6, condition: player.condition, armor: player.armor,
    health: player.health, radio: RADIO[missionIndex],
    dialogText, fixer: m.fixer, checkpoint: currentCheckpoint(), playerX: player.x, playerZ: player.z,
    heading: player.heading,
    dispatch: police.dispatchRows(player),
    police: police.allPositions(),
    crew: crew.rows(money), eyesOut: crew.eyesActive(),
    maxCondition: maxCondition(), armorMax: armorMax(),
  };
}
let last = performance.now();
let hudAcc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = Math.min(0.1, (now - last) / 1000); last = now;
  const dt = paused ? 0 : rawDt;
  if (started && !allDone && !shotMode && !transitioning) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; failMission('Time up.'); }
  }
  if (started && dt > 0) {
    const inp = readInput();
    // arcade driving (dt-based so low-FPS headless still moves the car)
    const maxSpeed = 38, maxReverse = 10;
    if (inp.throttle > 0) player.speed += 15 * inp.throttle * dt;
    else if (inp.throttle < 0) player.speed -= 12 * dt;
    if (inp.brake) player.speed -= Math.sign(player.speed) * 26 * dt;
    if (inp.throttle === 0 && !inp.brake) player.speed -= Math.sign(player.speed) * Math.min(Math.abs(player.speed), 5 * dt);
    player.speed = Math.max(-maxReverse, Math.min(maxSpeed, player.speed));
    if (shotDrive) player.speed = CRUISE_KMH / 3.6; // real cruise at 100 km/h, HUD shows true state
    const steerAuthority = 1.9 * Math.min(1, Math.abs(player.speed) / 10 + 0.25) * (player.speed < 0 ? -1 : 1);
    player.heading += inp.steer * steerAuthority * dt * (inp.brake ? 1.35 : 1);
    player.x += Math.sin(player.heading) * player.speed * dt;
    player.z += Math.cos(player.heading) * player.speed * dt;
    collideBuildings();
    // police contact damage (+heat) — spaced hits so a pile-on can't insta-wreck the car
    for (const c of police.cars) {
      const d = Math.hypot(c.group.position.x - player.x, c.group.position.z - player.z);
      if (d < 3.4 && performance.now() - player.lastHit > 1200) {
        player.lastHit = performance.now();
        player.condition = Math.max(0, player.condition - 3 * (1 - damageReduction()));
        player.armor = Math.max(0, player.armor - 1);
        player.speed *= 0.85; // soft shove, not a pin — the car must stay drivable while rammed
        heat = Math.min(100, heat + 20);
      }
    }
    // HEAT / WANTED — live: rises when police are close, falls when you escape
    let nearest = Infinity;
    for (const c of police.cars) {
      nearest = Math.min(nearest, Math.hypot(c.group.position.x - player.x, c.group.position.z - player.z));
    }
    if (police.heli) nearest = Math.min(nearest, Math.hypot(police.heli.group.position.x - player.x, police.heli.group.position.z - player.z));
    // SWAP PLATES active: police are slower to recognize the car — heat rises
    // half as fast and drains on its own, so wanted drops slowly
    const plates = crew.platesActive();
    if (nearest < 18) heat = Math.min(100, heat + (plates ? 4 : 8) * dt);
    else if (nearest > 70) heat = Math.max(0, heat - (plates ? 8 : 5) * dt);
    else heat = Math.max(0, heat - (plates ? 4 : 1) * dt);
    if (plates) heat = Math.max(0, heat - 2.5 * dt);
    wantedLevel = Math.max(1, Math.min(5, currentMission().wanted + (heat >= 70 ? 1 : 0) - (heat <= 10 ? 1 : 0)));
    // dialog TRIGGER AREA: fixer speaks when the player closes in on the checkpoint
    // (skipped in driving-shot mode so the staged dialog + stage stay put)
    const cp = currentCheckpoint();
    const cd = Math.hypot(cp.x - player.x, cp.z - player.z);
    if (!shotDrive && stage < currentMission().stages.length) {
      if (cd < 35 && !nearShown[stage]) {
        nearShown[stage] = true;
        setDialog(`Almost there — ${cp.label} just ahead.`);
      }
      if (cd < 10) completeStage();
    }
    // condition slow regen when calm (caps at the upgraded maximum)
    if (performance.now() - player.lastHit > 3000 && player.condition < maxCondition()) {
      player.condition = Math.min(maxCondition(), player.condition + 2 * dt);
    }
    if (player.health <= 0) failMission('Busted — the REDFIRE V8 is wrecked.');
    // marker pulse
    const pulse = 1 + 0.12 * Math.sin(now / 160);
    markerRing.scale.set(pulse, pulse, 1);
    markerRing.rotation.z += dt * 0.6;
    updateWeapons(dt);
    if (shotDrive) player.speed = CRUISE_KMH / 3.6; // re-clamp after any ram shove so HUD stays at 100
    police.update(dt, player, groundY, { slow: crew.platesActive() });
    // BAY AUTO garage zone: show the prompt when the player drives into the pad
    inGarageZone = !shotMode && !transitioning &&
      player.x >= GARAGE_ZONE.minX && player.x <= GARAGE_ZONE.maxX &&
      player.z >= GARAGE_ZONE.minZ && player.z <= GARAGE_ZONE.maxZ;
    document.getElementById('garage-prompt').style.display =
      (inGarageZone && !garageOpen && started) ? 'block' : 'none';
  }
  // smooth ground height (bridge ramps / pier)
  const gy = groundY(player.x, player.z);
  player.y += (gy - player.y) * Math.min(1, rawDt * 8);
  car.position.set(player.x, player.y, player.z);
  car.rotation.y = player.heading;
  car.rotation.z = -readInput().steer * Math.min(0.06, Math.abs(player.speed) * 0.002);
  updateCamera(rawDt);
  // HUD ~15Hz
  hudAcc += rawDt;
  if (hudAcc > 0.066) {
    hudAcc = 0;
    hud.update(hudSnapshot());
  }
  if (bannerUntil && now > bannerUntil) {
    document.getElementById('mission-complete').style.display = 'none';
    bannerUntil = 0;
  }
  renderer.render(scene, camera);
}

// ---- title screen + menu buttons ----
document.getElementById('new-btn').addEventListener('click', newGame);
document.getElementById('continue-btn').addEventListener('click', () => { continueGame(); });
document.getElementById('controls-btn').addEventListener('click', () => {
  document.getElementById('controls-overlay').style.display = 'flex';
});
document.getElementById('controls-close-btn').addEventListener('click', () => {
  document.getElementById('controls-overlay').style.display = 'none';
});
document.getElementById('garage-btn').addEventListener('click', () => {
  document.getElementById('title-screen').style.display = 'none';
  openGarage(true);
});
document.getElementById('garage-close-btn').addEventListener('click', closeGarage);
document.getElementById('body-upgrade-btn').addEventListener('click', buyUpgrade);
// garage paint swatches (built from GARAGE_COLORS)
for (const c of GARAGE_COLORS) {
  const el = document.createElement('div');
  el.className = 'swatch' + (c.hex === carColor ? ' selected' : '');
  el.style.background = c.css;
  el.title = `${c.name} — $${PAINT_COST}`;
  el.dataset.hex = String(c.hex);
  el.addEventListener('click', () => buyPaint(c.hex));
  document.getElementById('paint-swatches').appendChild(el);
}
// crew panel rows are clickable (same as Z / X / C keys)
document.querySelectorAll('#crew .skill').forEach((el) => {
  el.addEventListener('click', () => useCrew(Number(el.dataset.skill)));
});
refreshTitleMenu();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- debug API (harness + staged shots) ----
window.__game = {
  input: null,
  state() {
    const m = currentMission();
    return {
      started, paused, allDone, shotMode, shotDrive,
      mission: missionIndex + 1, missionName: m.name, stage: stage + 1,
      stages: m.stages.length, timeLeft: Math.round(timeLeft),
      x: +player.x.toFixed(2), z: +player.z.toFixed(2), y: +player.y.toFixed(2),
      heading: +player.heading.toFixed(3), speedKmh: +(player.speed * 3.6).toFixed(1),
      condition: Math.round(player.condition), armor: Math.round(player.armor),
      health: Math.round(player.health), money, respect, wanted: wantedLevel, heat: Math.round(heat),
      dialogText, dialogCount: dialogLog.length,
      checkpoint: currentCheckpoint(),
      checkpointDist: +Math.hypot(currentCheckpoint().x - player.x, currentCheckpoint().z - player.z).toFixed(1),
      police: police.cars.length, heli: !!police.heli,
      money, respect, carColor, bodyLevel, garageOpen, inGarageZone,
      platesActive: crew.platesActive(), eyesActive: crew.eyesActive(),
      saveExists: !!loadSave(),
      colliders: world.colliders,
    };
  },
  // crew + garage + save (harness + staged shots)
  crewUse(i) { return useCrew(i); },
  crewState() {
    return { money, rows: crew.rows(money), platesActive: crew.platesActive(), eyesActive: crew.eyesActive() };
  },
  openGarage() { openGarage(started ? false : true); },
  closeGarage() { closeGarage(); },
  garageState() {
    return {
      money, carColor, bodyLevel,
      maxCondition: maxCondition(), armorMax: armorMax(),
      condition: Math.round(player.condition), armor: Math.round(player.armor),
      nextUpgrade: nextBodyLevel(bodyLevel),
    };
  },
  buyPaint(hex) { return buyPaint(hex); },
  buyUpgrade() { return buyUpgrade(); },
  newGame() { newGame(); },
  continueGame() { return continueGame(); },
  saveInfo() { return loadSave(); },
  setMoney(n) { money = n; },
  damageCar(condition, armor) { player.condition = condition; player.armor = armor; player.lastHit = performance.now(); },
  setGarageShot() {
    // stage the car inside the BAY AUTO pad, camera framing car + GARAGE sign,
    // then open the garage overlay — real scene behind a real overlay
    shotMode = true; shotDrive = false; player.shotDrive = false; started = true; paused = true;
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('mission-complete').style.display = 'none';
    startMission(2); // golden-hour mission backdrop (marina)
    const ctx = { scene, camera, car, player, police, groundY, setDialog: (t) => { dialogText = t; }, setStage: (s) => { stage = s; placeMarker(); } };
    stageGarage(ctx);
    hud.update(hudSnapshot());
    openGarage(false);
  },
  startMission(i) {
    document.getElementById('title-screen').style.display = 'none';
    started = true; shotMode = false; shotDrive = false; player.shotDrive = false;
    startMission(i);
  },
  teleport(x, z, heading) {
    // never drop the car into the channel water off the bridge deck — snap to the deck centerline
    if (x > WORLD.channelX0 && x < WORLD.channelX1 && !(z >= 20 && z <= 40)) z = 30;
    player.x = x; player.z = z;
    if (heading !== undefined) player.heading = heading;
    player.speed = 0; player.y = groundY(x, z);
    camPos.set(x - Math.sin(player.heading) * 10.5, player.y + 4.3, z - Math.cos(player.heading) * 10.5);
  },
  setWeapon(i) { weapon = i; hud.setWeapon(i); },
  fire() { fireQueued = true; },
  pause(v) { paused = v; },
  dialogLog() { return dialogLog.slice(); },
  setShot(n) {
    // staged, deterministic pose for screenshots — real game state, real HUD
    shotMode = true; shotDrive = false; player.shotDrive = false; started = true; paused = true;
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('mission-complete').style.display = 'none';
    startMission(n - 1);
    const ctx = { scene, camera, car, player, police, groundY, setDialog: (t) => { dialogText = t; }, setStage: (s) => { stage = s; placeMarker(); } };
    stageShot(n, ctx);
    // record the staged framing relative to the car (used by the driving-shot tracking camera)
    const cp = new THREE.Vector3(player.x, player.y, player.z);
    shotCamOffset.copy(camera.position).sub(cp);
    if (ctx.lookTarget) shotLookOffset.copy(ctx.lookTarget).sub(cp);
    // refresh HUD once for the staged state
    hud.update(hudSnapshot());
  },
  setDrivingShot(n) {
    // same staging, but the car REALLY cruises at 100 km/h (real game state,
    // real HUD speed) while the staged camera tracks it — no frozen pose
    window.__game.setShot(n);
    window.__game.input = null;
    shotDrive = true; player.shotDrive = true; paused = false;
  },
};

// URL params: ?mission=N&autostart=1 (harness) or ?shot=N (staged screenshot)
const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  const n = Math.max(1, Math.min(4, parseInt(params.get('shot'), 10) || 1));
  window.__game.setShot(n);
} else if (params.get('autostart')) {
  const n = Math.max(1, Math.min(4, parseInt(params.get('mission') || '1', 10)));
  window.__game.startMission(n - 1);
} else {
  // normal load: mission 1 behind the title screen
  startMission(0);
}
requestAnimationFrame(loop);
