// police.js — pursuit AI, roadblock, helicopter follow.
// Dispatch actions are ONLY from: RAMMING, SPOTLIGHT, ROADBLOCK, FLANKING, FIRING.
import * as THREE from 'three';
import { makePoliceCar, makeHeli } from './vehicles.js';

// light-bar flash shared by chase cars, roadblock units and the shot-drive formation
function flashBar(group, t) {
  const on = Math.sin(t) > 0;
  group.userData.barR.material.emissiveIntensity = on ? 2.4 : 0.25;
  group.userData.barB.material.emissiveIntensity = on ? 0.25 : 2.4;
}
import { toon, applyOutlines } from './world.js';

export const ALLOWED_ACTIONS = ['RAMMING', 'SPOTLIGHT', 'ROADBLOCK', 'FLANKING', 'FIRING'];

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// point the heli searchlight at the player (was the same two lines in both
// the shot-drive branch and the live pursuit branch of update())
function aimSpotlight(heliGroup, player) {
  heliGroup.userData.spot.target.position.set(player.x - heliGroup.position.x, -32, player.z - heliGroup.position.z);
  heliGroup.userData.spot.target.updateMatrixWorld();
}

// Orange-white diagonal stripe texture for roadblock barriers (from the reference).
function barrierTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#ff5a1f';
  for (let x = -32; x < 160; x += 32) {
    g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let BARRIER_TEX = null;

export class PoliceManager {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];   // {group, heading, speed, action, name, stuck}
    this.heli = null; // {group, name, action:'SPOTLIGHT'}
    this.roadblock = [];
    this.barriers = [];
    this.time = 0;
  }

  clear() {
    for (const c of this.cars) this.scene.remove(c.group);
    for (const c of this.roadblock) this.scene.remove(c.group);
    for (const b of this.barriers) this.scene.remove(b);
    if (this.heli) this.scene.remove(this.heli.group);
    this.cars = []; this.roadblock = []; this.barriers = []; this.heli = null;
  }

  spawn(mission, playerPos) {
    this.clear();
    const units = mission.units || [];
    // chase cars spawn behind / around the player — names + actions from the mission
    for (let i = 0; i < mission.policeCars; i++) {
      const g = makePoliceCar();
      const a = (i / mission.policeCars) * Math.PI * 2 + 0.6;
      g.position.set(playerPos.x + Math.sin(a) * 42, 0, playerPos.z + Math.cos(a) * 42);
      this.scene.add(g);
      const u = units[i] || { name: 'UNIT 0' + (i + 1), action: 'RAMMING' };
      this.cars.push({
        group: g, heading: 0, speed: 0,
        action: u.action, spawnAction: u.action,
        name: u.name, stuck: 0,
        // lateral flank offset so the pack spreads out instead of stacking on one point
        offset: (i - (mission.policeCars - 1) / 2) * 7,
      });
    }
    // roadblock: police cars + striped barriers across the road
    if (mission.roadblock) {
      const { x, z } = mission.roadblock;
      const rbNames = mission.roadblockUnits || ['UNIT 50', 'UNIT 51', 'UNIT 52'];
      const spots = [
        { x: x - 2, z: z - 4.5, h: Math.PI / 2 },
        { x: x + 2, z: z + 4.5, h: Math.PI / 2 },
        { x: x + 8, z: z, h: Math.PI / 4 },
      ];
      spots.forEach((s, i) => {
        const g = makePoliceCar();
        g.position.set(s.x, 0, s.z); g.rotation.y = s.h;
        this.scene.add(g);
        this.roadblock.push({ group: g, name: rbNames[i] || ('UNIT ' + (50 + i)), action: 'ROADBLOCK', x: s.x, z: s.z });
      });
      if (!BARRIER_TEX) BARRIER_TEX = barrierTexture();
      for (const bz of [-7, 7]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.15, 4.6),
          new THREE.MeshToonMaterial({ map: BARRIER_TEX }));
        b.position.set(x - 1, 0.6, z + bz);
        b.castShadow = true;
        applyOutlines(b);
        this.scene.add(b);
        this.barriers.push(b);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), toon(0x3a3f4a));
        leg.position.set(x - 1, 0.25, z + bz - 2);
        this.scene.add(leg); this.barriers.push(leg);
        const leg2 = leg.clone(); leg2.position.z = z + bz + 2;
        this.scene.add(leg2); this.barriers.push(leg2);
      }
    }
    // helicopter with spotlight
    if (mission.heli) {
      const g = makeHeli();
      g.position.set(playerPos.x + 14, 34, playerPos.z - 18);
      this.scene.add(g);
      this.heli = { group: g, name: mission.heliName || 'AIR ONE', action: 'SPOTLIGHT' };
    }
  }

  // dt seconds; player = {x, z, heading, speed}; groundY = fn(x,z)
  // mods.slow (SWAP PLATES active): police recognize the car slower — lower top speed.
  update(dt, player, groundY, mods = {}) {
    this.time += dt;
    // DRIVING-SHOT formation: police + heli travel WITH the player at cruise
    // speed so the staged composition holds while the player really drives.
    // (The live pursuit AI would pile every unit onto the player in under a
    // second and wreck the shot.)
    if (player.shotDrive) {
      const vx = Math.sin(player.heading) * player.speed * dt;
      const vz = Math.cos(player.heading) * player.speed * dt;
      for (const c of this.cars) {
        c.group.position.x += vx; c.group.position.z += vz;
        c.group.position.y = groundY(c.group.position.x, c.group.position.z);
        c.speed = player.speed;
        flashBar(c.group, this.time * 10);
      }
      if (this.heli) {
        const h = this.heli.group;
        h.position.x += vx; h.position.z += vz; // staged altitude kept
        h.rotation.y += dt * 0.25;
        h.userData.rotor.rotation.y += dt * 22;
        aimSpotlight(h, player);
      }
    } else {
      // SWAP PLATES: police are slower to recognize the car (25% slower pursuit)
      const maxSpeed = (24 + Math.min(4, player.speed * 0.12)) * (mods.slow ? 0.75 : 1);
      for (const c of this.cars) {
      // aim at a flank point beside the player (offset shrinks to 0 when closing in to ram)
      const dx0 = player.x - c.group.position.x;
      const dz0 = player.z - c.group.position.z;
      const dist0 = Math.hypot(dx0, dz0) || 1;
      const off = dist0 > 12 ? c.offset : 0;
      const tx = player.x + (-dz0 / dist0) * off;
      const tz = player.z + (dx0 / dist0) * off;
      const dx = tx - c.group.position.x;
      const dz = tz - c.group.position.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      // pursuit with a little wobble so it reads as driving, not homing
      const wob = Math.sin(this.time * 0.9 + c.group.position.x) * 0.12;
      c.heading = angleLerp(c.heading, targetHeading + wob, Math.min(1, dt * 2.2));
      const want = dist > 10 ? maxSpeed : maxSpeed * 0.55;
      c.speed += (want - c.speed) * Math.min(1, dt * 0.9);
      c.group.position.x += Math.sin(c.heading) * c.speed * dt;
      c.group.position.z += Math.cos(c.heading) * c.speed * dt;
      c.group.position.y = groundY(c.group.position.x, c.group.position.z);
      c.group.rotation.y = c.heading;
      // stuck detection: barely moving while far -> nudge heading
      if (c.speed > 2 && dist > 25) c.stuck += dt; else c.stuck = 0;
      if (c.stuck > 2.5) { c.heading += 0.9; c.stuck = 0; }
      // light bar flash
      flashBar(c.group, this.time * 10);
      // action swaps by distance (only allowed actions)
      c.action = dist < 14 ? 'RAMMING' : (dist < 30 ? 'FLANKING' : 'FIRING');
      }
    }
    for (const rb of this.roadblock) flashBar(rb.group, this.time * 10 + 1);
    if (this.heli && !player.shotDrive) {
      const h = this.heli.group;
      const tx = player.x + 10, tz = player.z - 14;
      h.position.x += (tx - h.position.x) * Math.min(1, dt * 0.8);
      h.position.z += (tz - h.position.z) * Math.min(1, dt * 0.8);
      h.position.y = 32 + Math.sin(this.time * 0.7) * 1.5;
      h.rotation.y += dt * 0.25;
      h.userData.rotor.rotation.y += dt * 22;
      // spotlight tracks the player
      aimSpotlight(h, player);
    }
  }

  // one dispatch row: [name, distance m, action] (was the same distance math
  // repeated for chase cars, roadblock units and the heli)
  dispatchRow(player, name, x, z, action) {
    const d = Math.round(Math.hypot(player.x - x, player.z - z));
    return { name, dist: d, action };
  }

  // rows for the DISPATCH panel: [name, distance m, action] — actions from allowed list only
  dispatchRows(player) {
    const rows = [];
    for (const c of this.cars) {
      rows.push(this.dispatchRow(player, c.name, c.group.position.x, c.group.position.z, c.action));
    }
    for (const rb of this.roadblock) {
      rows.push(this.dispatchRow(player, rb.name, rb.x, rb.z, 'ROADBLOCK'));
    }
    if (this.heli) {
      rows.push(this.dispatchRow(player, this.heli.name, this.heli.group.position.x, this.heli.group.position.z, 'SPOTLIGHT'));
    }
    rows.sort((a, b) => a.dist - b.dist);
    return rows.slice(0, 4);
  }

  allPositions() {
    const out = this.cars.map(c => ({ x: c.group.position.x, z: c.group.position.z, kind: 'car' }));
    for (const rb of this.roadblock) out.push({ x: rb.x, z: rb.z, kind: 'block' });
    if (this.heli) out.push({ x: this.heli.group.position.x, z: this.heli.group.position.z, kind: 'heli' });
    return out;
  }
}
