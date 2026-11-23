// vehicles.js — low-poly cars + helicopter, built from boxes (cel-shaded).
import * as THREE from 'three';
import { toon, applyOutlines } from './world.js';

function wheel(x, z) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), toon(0x14161c));
  w.rotation.z = Math.PI / 2;
  w.position.set(x, 0.55, z);
  w.castShadow = true;
  return w;
}
function headlight(x, z, color = 0xfff2b0) {
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.15),
    toon(color, { emissive: color, emissiveIntensity: 1.8 }));
  h.position.set(x, 0.95, z);
  return h;
}
// both cars mount the same 4-wheel set + headlight pair (was the same two
// g.add(...) lines copied into makeMuscleCar and makePoliceCar)
function addWheelSet(g, halfW, frontZ, backZ) {
  g.add(wheel(-halfW, frontZ), wheel(halfW, frontZ), wheel(-halfW, backZ), wheel(halfW, backZ));
}
function addHeadlightPair(g, x, z) {
  g.add(headlight(-x, z), headlight(x, z));
}

export function makeMuscleCar(color = 0xe8321e) {
  const g = new THREE.Group();
  // body — long, wide, bright red
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 4.9), toon(color));
  body.position.y = 0.85; body.castShadow = true; g.add(body);
  body.userData.paint = 'body'; // garage repaint target (geometry unchanged)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 1.5), toon(0xc22714));
  hood.position.set(0, 1.3, 1.45); hood.castShadow = true; g.add(hood);
  hood.userData.paint = 'hood'; // garage repaint target (darker shade of the paint)
  // cabin with bright glass
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 2.2), toon(0x1e3a5c));
  cabin.position.set(0, 1.55, -0.35); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.18, 2.0), toon(color));
  roof.position.set(0, 1.98, -0.35); g.add(roof);
  roof.userData.paint = 'body'; // garage repaint target
  // racing stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 4.92), toon(0xffffff));
  stripe.position.set(0, 1.24, 0); g.add(stripe);
  // spoiler
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.5), toon(0x14161c));
  spoiler.position.set(0, 1.45, -2.3); g.add(spoiler);
  // wheels + headlights + taillights
  addWheelSet(g, 1.15, 1.6, -1.6);
  addHeadlightPair(g, 0.8, 2.48);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.12),
    toon(0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 1.5 }));
  tl.position.set(-0.8, 0.95, -2.48); g.add(tl);
  const tl2 = tl.clone(); tl2.position.x = 0.8; g.add(tl2);
  // headlight beam cones (visible at dusk/night)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10, depthWrite: false });
  for (const s of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 8, 1, true), beamMat);
    beam.rotation.x = Math.PI / 2 + 0.12;
    beam.position.set(s * 0.8, 0.8, 6);
    g.add(beam);
  }
  applyOutlines(g);
  return g;
}

// Garage repaint: swap the paint materials of the tagged body/hood/roof meshes.
// Geometry, stripe, spoiler, wheels and lights are untouched — only the paint color changes.
// hood is the body color darkened by this factor (same factor the painter used)
const REPAINT_DARKEN = 0.72;

export function repaintCar(carGroup, colorHex) {
  const c = new THREE.Color(colorHex);
  const dark = c.clone().multiplyScalar(REPAINT_DARKEN);
  carGroup.traverse((o) => {
    if (!o.isMesh || !o.userData.paint) return;
    if (o.userData.paint === 'body') o.material = toon(c.getHex());
    else if (o.userData.paint === 'hood') o.material = toon(dark.getHex());
  });
}

// one light-bar lamp (red or blue); the pair flashes in police.js
function lightBar(color, x) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.5),
    toon(color, { emissive: color, emissiveIntensity: 2 }));
  bar.position.set(x, 2.1, -0.3);
  return bar;
}

export function makePoliceCar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.6), toon(0xf2f2f2));
  body.position.y = 0.85; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.7, 2.1), toon(0x1e3a5c));
  cabin.position.set(0, 1.6, -0.3); cabin.castShadow = true; g.add(cabin);
  // black doors + PD livery stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 4.0), toon(0x14161c));
  stripe.position.set(0, 0.85, 0); g.add(stripe);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.5, 1.2), toon(0x2456ff));
  badge.position.set(0, 1.15, 0.4); g.add(badge);
  // light bar (flashes red/blue)
  const barR = lightBar(0xff2a2a, -0.45); g.add(barR);
  const barB = lightBar(0x2a6bff, 0.45); g.add(barB);
  addWheelSet(g, 1.1, 1.55, -1.55);
  addHeadlightPair(g, 0.75, 2.35);
  g.userData = { barR, barB };
  applyOutlines(g);
  return g;
}

export function makeHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 4.4), toon(0x1c2733));
  body.position.y = 0; body.castShadow = true; g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.4), toon(0x9fd8ff, { emissive: 0x2a6b8a, emissiveIntensity: 0.5 }));
  glass.position.set(0, 0.2, 1.8); g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.2), toon(0x1c2733));
  tail.position.set(0, 0.3, -3.8); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 1.2), toon(0xff2a2a));
  fin.position.set(0, 0.9, -5.6); g.add(fin);
  const rotor = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), toon(0x14161c));
  rotor.add(blade);
  const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
  rotor.position.y = 1.4; g.add(rotor);
  // searchlight: visible cone + spotlight
  // Cone is apex-UP (narrow at the heli, wide at the ground) — NOT flipped:
  // the old flipped cone was 14m wide at the heli and washed out buildings.
  const spot = new THREE.SpotLight(0xfff2b0, 900, 60, 0.18, 0.4, 1.2);
  spot.position.set(0, -0.8, 0.5);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -40, 8);
  g.add(spotTarget); spot.target = spotTarget; g.add(spot);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 16, 1, true), coneMat);
  cone.position.set(0, -17, 4);
  g.add(cone);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6),
    toon(0xfff2b0, { emissive: 0xffe95a, emissiveIntensity: 2.5 }));
  lamp.position.set(0, -0.9, 0.5); g.add(lamp);
  g.userData = { rotor, spot, cone };
  applyOutlines(g);
  return g;
}
