// world.js — Venus Coast city: bright readable roads, colorful lit buildings,
// beach + pier (south), marina bridge (east). Low-poly cel-shaded (MeshToonMaterial).
import * as THREE from 'three';

// ---- toon gradient (3-step cel) ----
function makeGradientMap() {
  const c = new Uint8Array([90, 160, 255, 255]);
  const tex = new THREE.DataTexture(c, 4, 1, THREE.RedFormat);
  tex.needsUpdate = true;
  return tex;
}
const GRAD = makeGradientMap();
const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({
    color, gradientMap: GRAD,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
  });
  matCache.set(key, m);
  return m;
}
function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// ---- cel outline: thin black inverted hull on every toon mesh ----
// Cheap (no post-processing pass): a slightly larger black BackSide copy of the
// same geometry. Only MeshToonMaterial meshes get one; flat planes (roads,
// ground, ocean) and basic-material effects (sun, beams, markers) are skipped.
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x0b0b12, side: THREE.BackSide });
export function applyOutlines(root, scale = 1.035) {
  const targets = [];
  root.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshToonMaterial &&
        o.geometry && o.geometry.type !== 'PlaneGeometry' && !o.userData.noOutline) {
      targets.push(o);
    }
  });
  for (const m of targets) {
    const ol = new THREE.Mesh(m.geometry, OUTLINE_MAT);
    ol.scale.setScalar(scale);
    ol.castShadow = false; ol.receiveShadow = false;
    ol.raycast = () => {};
    m.add(ol);
  }
  return targets.length;
}

// Canvas texture: grid of bright lit windows on a wall color.
function windowsTexture(wall, litColors) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, 128, 256);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
    g.fillStyle = litColors[(r * 4 + c) % litColors.length];
    g.fillRect(10 + c * 30, 12 + r * 30, 20, 18);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const WORLD = {
  minX: -230, maxX: 230, minZ: -230, maxZ: 230,
  beachZ: 150,            // ocean starts here (south)
  pierX: 0, pierEndZ: 262,
  bridgeZ: 30,           // marina bridge crosses the east channel at z=30
  channelX0: 100, channelX1: 145,
};

// Road network: streets at these coordinates (both axes), width 14.
const STREETS = [-160, -80, 0, 80, 160];
const ROAD_W = 14;

// building footprint/height cycle (3 widths x 3 depths x 4 heights)
function buildingSize(bi) {
  return { w: 34 + (bi % 3) * 6, d: 30 + ((bi + 1) % 3) * 6, h: 16 + (bi % 4) * 7 };
}

// warm lamp glow orb (streetlights use 1.6, pier/bridge lamps 1.8)
function glowOrb(r, intensity) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6),
    toon(0xffe9a8, { emissive: 0xffd23f, emissiveIntensity: intensity }));
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = []; // {minX,maxX,minZ,maxZ}

  // ---- ground: warm light sand/grass base ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), toon(0x8fa06b));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
  group.add(ground);

  // ---- ocean (south) + beach sand ----
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 260), toon(0x1e7fc4));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0.02, 300); ocean.receiveShadow = true;
  group.add(ocean);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(900, 34), toon(0xe8d29a));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.03, 167); sand.receiveShadow = true;
  group.add(sand);
  // east channel (marina bay inlet) — water strip the bridge crosses
  // placed between streets x=80 and x=160 so no north-south road is cut
  const channel = new THREE.Mesh(new THREE.PlaneGeometry(45, 220), toon(0x1e7fc4));
  channel.rotation.x = -Math.PI / 2; channel.position.set(122.5, 0.02, 10); channel.receiveShadow = true;
  group.add(channel);

  // ---- roads: BRIGHT asphalt + thick yellow center line + white dashes + sidewalks ----
  const roadMat = toon(0x777d89);
  const walkMat = toon(0xc9c2b2);
  const lineMat = toon(0xffc21c);
  const dashMat = toon(0xffffff);
  // one place owns a flat ground plane (road surface, sidewalks, center line,
  // dashes — was the same 4-line create/rotate/position/receiveShadow block
  // copied a dozen times inside road())
  function flatPlane(w, d, mat, x, y, z, receiveShadow = true, parent = group) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = receiveShadow;
    parent.add(p);
    return p;
  }
  function road(x, z, w, d) {
    flatPlane(w, d, roadMat, x, 0.06, z);
    // sidewalks (light strips both sides)
    const sw = 3;
    if (d > w) { // north-south road
      for (const s of [-1, 1]) {
        flatPlane(sw, d, walkMat, x + s * (w / 2 + sw / 2), 0.05, z);
      }
      flatPlane(0.7, d, lineMat, x, 0.08, z, false);
      for (let zz = -210; zz <= 210; zz += 14) {
        flatPlane(0.5, 5, dashMat, x - 4.4, 0.08, zz, false);
        flatPlane(0.5, 5, dashMat, x + 4.4, 0.08, zz, false);
      }
    } else { // east-west road
      for (const s of [-1, 1]) {
        flatPlane(w, sw, walkMat, x, 0.05, z + s * (d / 2 + sw / 2));
      }
      flatPlane(w, 0.7, lineMat, x, 0.08, z, false);
      for (let xx = -210; xx <= 210; xx += 14) {
        flatPlane(5, 0.5, dashMat, xx, 0.08, z - 4.4, false);
        flatPlane(5, 0.5, dashMat, xx, 0.08, z + 4.4, false);
      }
    }
  }
  for (const x of STREETS) road(x, 0, ROAD_W, 440);
  for (const z of STREETS) road(0, z, 440, ROAD_W);

  // ---- zebra crossings at every intersection ----
  for (const x of STREETS) for (const z of STREETS) {
    for (let i = -2; i <= 2; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 5.5), dashMat);
      s.rotation.x = -Math.PI / 2; s.position.set(x + i * 2.6, 0.09, z - 9.5); group.add(s);
      const s2 = s.clone(); s2.position.z = z + 9.5; group.add(s2);
    }
  }

  // ---- buildings: bright saturated colors, LIT windows (never dark silhouettes) ----
  const palette = [
    { wall: '#ff7a59', win: ['#ffe66d', '#fff6bf', '#ffd23f'] },
    { wall: '#2ec4b6', win: ['#fff6bf', '#ffe66d', '#b8fff1'] },
    { wall: '#ffbf69', win: ['#fff6bf', '#ffffff', '#ffd23f'] },
    { wall: '#c77dff', win: ['#ffe66d', '#fff6bf', '#e0aaff'] },
    { wall: '#90be6d', win: ['#fff6bf', '#ffe66d', '#ffffff'] },
    { wall: '#f984a0', win: ['#fff6bf', '#ffffff', '#ffd23f'] },
    { wall: '#4cc9f0', win: ['#fff6bf', '#ffe66d', '#ffffff'] },
  ];
  const neonWords = ['HOTEL', 'PIER', 'TACOS', 'NEON', 'CLUB', 'MARINA', 'SURF', 'BAR', 'WANTED'];
  function neonSign(text, color) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, 256, 64);
    g.font = '900 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 18;
    g.fillText(text, 128, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshBasicMaterial({ map: t }));
  }
  let bi = 0;
  for (const bx of [-200, -120, -40, 40, 120]) {
    for (const bz of [-200, -120, -40, 40, 120]) {
      if (Math.abs(bx) < 20 && Math.abs(bz) < 20) continue; // keep central plaza open
      if (bx === 120 && bz === 120) continue; // marina lot (mission 3)
      if (bz === 40 && (bx === 40 || bx === 120)) continue; // keep the marina bridge corridor (x 40..200, z 20..40) clear — a building here blocks the whole deck
      const p = palette[bi % palette.length]; bi++;
      const { w, d, h } = buildingSize(bi);
      const tex = windowsTexture(p.wall, p.win);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshToonMaterial({ map: tex, gradientMap: GRAD }));
      m.position.set(bx, h / 2, bz); m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      // roof rim (bright) + neon sign on some buildings
      group.add(box(w + 1, 1, d + 1, 0xffffff, bx, h + 0.5, bz));
      if (bi % 2 === 0) {
        const sign = neonSign(neonWords[bi % neonWords.length], ['#ff5fa2', '#57f7ff', '#ffd23f'][bi % 3]);
        sign.position.set(bx, h - 3, bz + d / 2 + 0.15);
        group.add(sign);
      }
      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
    }
  }

  // ---- palms in regular rows along roads + beach ----
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), toon(0x8a5a2b));
    trunk.position.y = 3.5; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.4, 4), toon(0x2fae4e));
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.6, 7.4, Math.sin(a) * 1.6);
      frond.rotation.z = Math.cos(a) * 1.1; frond.rotation.x = -Math.sin(a) * 1.1;
      frond.castShadow = true; g.add(frond);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (const z of [-200, -120, -40, 40, 120, 160]) {
    for (const x of [-170, -90, -10, 70, 150]) palm(x + 9, z + 9);
  }
  // beach palms sit on the sand SOUTH of the beach road (z=174), never on the
  // road surface — the old row at z=158 put a trunk 8m from the shot-1 camera
  // and the car drove straight through trunks.
  for (let x = -200; x <= 200; x += 26) palm(x, 174);

  // ---- streetlights along main roads ----
  const lampHeads = [];
  function streetlight(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 6), toon(0x3a3f4a));
    pole.position.y = 3.25; g.add(pole);
    const head = glowOrb(0.55, 1.6);
    head.position.y = 6.6; g.add(head);
    lampHeads.push(head);
    g.position.set(x, 0, z); group.add(g);
  }
  for (const z of STREETS) for (const x of [-180, -100, -20, 60, 140]) streetlight(x + 8.5, z + 8.5);
  // extra lamps along the z=-160 night road (mission 4) — the old 80m gap left
  // the shot-4 facades in the dark
  for (const x of [-71.5, -51.5, -31.5, 8.5, 28.5, 48.5]) streetlight(x, -151.5);
  // warm point lights on the night road (night preset only, intensity set in setTimeOfDay)
  const nightLights = [];
  for (const x of [-30, 10]) {
    const pl = new THREE.PointLight(0xffc27a, 0, 70, 1.8);
    pl.position.set(x, 8, -152);
    scene.add(pl); nightLights.push(pl);
  }

  // ---- PIER (south, x=0): wooden deck into the ocean ----
  const pierMat = toon(0x9c6b3c);
  for (let z = 168; z <= 258; z += 6) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 5.4), pierMat);
    plank.position.set(0, 1.2, z); plank.castShadow = true; plank.receiveShadow = true;
    group.add(plank);
  }
  for (const s of [-1, 1]) {
    for (let z = 170; z <= 260; z += 18) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), toon(0x6b4423));
      post.position.set(s * 5.6, 0.4, z); group.add(post);
      const lamp = glowOrb(0.5, 1.8);
      lamp.position.set(s * 5.6, 2.6, z); group.add(lamp);
    }
  }
  // pier end booth + ferris wheel silhouette (bright, not dark)
  group.add(box(8, 5, 6, 0xff5fa2, 0, 3.7, 256));
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.5, 6, 24), toon(0xffd23f, { emissive: 0xff9a2e, emissiveIntensity: 0.9 }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), toon(['#ff5fa2', '#57f7ff', '#ffd23f'][i % 3], { emissive: 0x222222 }));
    const a = (i / 8) * Math.PI * 2;
    cab.position.set(Math.cos(a) * 9, Math.sin(a) * 9, 0); wheel.add(cab);
  }
  wheel.position.set(-24, 12, 250); group.add(wheel);

  // ---- MARINA BRIDGE (east, crosses channel at z=30, deck y=6) ----
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(90, 1.2, 16), toon(0x8a8f9c));
  deck.position.set(122.5, 6, 30); deck.castShadow = true; deck.receiveShadow = true;
  bridge.add(deck);
  // bright road paint on deck
  const deckLine = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.7), lineMat);
  deckLine.rotation.x = -Math.PI / 2; deckLine.position.set(122.5, 6.65, 30); bridge.add(deckLine);
  for (let x = 82; x <= 163; x += 12) {
    const d1 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
    d1.rotation.x = -Math.PI / 2; d1.position.set(x, 6.65, 25.6); bridge.add(d1);
    const d2 = d1.clone(); d2.position.z = 34.4; bridge.add(d2);
  }
  // ramps
  for (const s of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(28, 1, 16), toon(0x8a8f9c));
    ramp.position.set(122.5 + s * 58, 3, 30); ramp.rotation.z = s * -0.21;
    ramp.castShadow = true; ramp.receiveShadow = true; bridge.add(ramp);
  }
  // guardrails (red/white) + pillars + lamps
  for (const s of [-1, 1]) {
    for (let x = 80; x <= 165; x += 8.5) {
      bridge.add(box(7.5, 1.1, 0.5, x % 17 < 8.5 ? 0xff3b30 : 0xffffff, x, 7.2, 30 + s * 8));
    }
    for (let x = 88; x <= 158; x += 35) {
      bridge.add(box(3, 7, 3, 0x6b6f7a, x, 3, 30 + s * 7));
    }
    const lamp = glowOrb(0.6, 1.8);
    lamp.position.set(110, 9.4, 30 + s * 7.5); bridge.add(lamp);
  }
  group.add(bridge);
  // marina boats (bright, moored near bridge)
  function boat(x, z, color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 3.4), toon(color));
    hull.position.y = 0.8; g.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 2.6), toon(0xffffff));
    cab.position.set(-0.5, 2.4, 0); g.add(cab);
    g.position.set(x, 0.1, z); group.add(g);
  }
  boat(112, 62, 0xff5fa2); boat(135, -14, 0x57f7ff); boat(112, -52, 0xffd23f);
  // yachts with tall masts + white sails, moored in the channel where the
  // marina shot looks (north + south of the bridge deck)
  function yacht(x, z, color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 1.8, 4), toon(color));
    hull.position.y = 0.9; g.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), toon(0xffffff));
    cab.position.set(-1, 2.6, 0); g.add(cab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 11, 6), toon(0x3a3f4a));
    mast.position.set(0.5, 7.2, 0); g.add(mast);
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 9, 3.4), toon(0xffffff));
    // broad face toward the south (the marina camera looks north) — the old
    // orientation showed only the 0.18m edge, so the sail read as a thin line
    sail.rotation.set(0, Math.PI / 2, 0.08);
    sail.position.set(0.5, 7, 0); g.add(sail);
    g.position.set(x, 0.1, z); g.rotation.y = (x % 7) * 0.12;
    group.add(g);
  }
  yacht(116, 8, 0xffffff); yacht(136, 6, 0xffd23f); yacht(108, 52, 0x57f7ff); yacht(134, 60, 0xff5fa2);

  // ---- BAY AUTO GARAGE (new, additive): painted pad + GARAGE sign at the
  // marina lot edge (195,142). Flat paint only — no collider, no building:
  // it sits on open ground clear of roads, palms, the mission-3 checkpoint
  // (210,120) and the mission-4 start. Drive in and press G to open the garage.
  const garagePad = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), toon(0xb3541e));
  garagePad.rotation.x = -Math.PI / 2; garagePad.position.set(196, 0.07, 142);
  garagePad.receiveShadow = true; group.add(garagePad);
  const garageLine = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.6), lineMat);
  garageLine.rotation.x = -Math.PI / 2; garageLine.position.set(196, 0.09, 135.2); group.add(garageLine);
  const garageLine2 = garageLine.clone(); garageLine2.position.z = 148.8; group.add(garageLine2);
  const garageSign = neonSign('GARAGE', '#ff9a2e');
  garageSign.position.set(196, 7.5, 149.6); group.add(garageSign);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 7.5, 6), toon(0x3a3f4a));
    post.position.set(196 + s * 5, 3.75, 149.6); group.add(post);
  }

  // ---- sun disc in the sky (emissive, always visible) ----
  // radius 16: a big low sun, not a wall of orange (the old r=38 disc filled
  // half the frame once it was placed over the southern ocean)
  const sun = new THREE.Mesh(new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb03a, fog: false }));
  sun.position.set(-220, 80, -300); sun.lookAt(0, 20, 0);
  group.add(sun);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8f1ff, fog: false }));
  moon.position.set(240, 150, -300); moon.lookAt(0, 20, 0);
  moon.visible = false; group.add(moon);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x3a4a6b, 1.15);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffc27a, 2.0);
  sunLight.position.set(-120, 140, 60);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
  sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
  sunLight.shadow.camera.far = 500;
  scene.add(sunLight);

  const presets = [
    { // 1 sunset — big low sun over the southern ocean (visible in the pier shot)
      bg: 0xff8a4d, fog: [0xff8a4d, 120, 520], hemiSky: 0xffd9a0, hemiGround: 0x4a3a5a, hemiInt: 1.05,
      sunColor: 0xffb35c, sunInt: 2.0, sunPos: [-120, 90, 60], sunVisible: true, moonVisible: false,
      sunDisc: [200, 48, 420],
    },
    { // 2 dusk
      bg: 0x8a4a7a, fog: [0x8a4a7a, 110, 500], hemiSky: 0xd9a0c8, hemiGround: 0x2e2a4a, hemiInt: 0.95,
      sunColor: 0xff8a5c, sunInt: 1.6, sunPos: [-140, 55, 40], sunVisible: true, moonVisible: false,
      sunDisc: [80, 40, 420],
    },
    { // 3 golden hour — big low sun over the ocean south of the marina bridge
      bg: 0xffc95e, fog: [0xffc95e, 130, 560], hemiSky: 0xfff0b8, hemiGround: 0x5a4a3a, hemiInt: 1.25,
      sunColor: 0xffd27a, sunInt: 2.4, sunPos: [-100, 170, 80], sunVisible: true, moonVisible: false,
      sunDisc: [230, 40, 420],
    },
    { // 4 neon night — roads stay lit by streetlights + emissive windows
      bg: 0x0b1030, fog: [0x0b1030, 90, 460], hemiSky: 0x5a6ab0, hemiGround: 0x2e2a4a, hemiInt: 1.35,
      sunColor: 0x8ab4ff, sunInt: 1.3, sunPos: [120, 160, -40], sunVisible: false, moonVisible: true,
      sunDisc: [-220, 80, -300],
    },
  ];
  function setTimeOfDay(i) {
    const p = presets[i];
    scene.background = new THREE.Color(p.bg);
    scene.fog = new THREE.Fog(p.fog[0], p.fog[1], p.fog[2]);
    hemi.color.setHex(p.hemiSky); hemi.groundColor.setHex(p.hemiGround); hemi.intensity = p.hemiInt;
    sunLight.color.setHex(p.sunColor); sunLight.intensity = p.sunInt;
    sunLight.position.set(...p.sunPos);
    sun.visible = p.sunVisible; moon.visible = p.moonVisible;
    sun.position.set(...p.sunDisc); sun.lookAt(0, 20, 0);
    for (const l of nightLights) l.intensity = i === 3 ? 120 : 0;
  }

  // thin black cel outline on every toon mesh in the world
  const outlined = applyOutlines(group);
  return { group, colliders, setTimeOfDay, lampHeads, outlined, garageZone: GARAGE_ZONE };
}

// BAY AUTO garage zone (marina lot edge) — drive in, press G.
export const GARAGE_ZONE = { minX: 186, maxX: 206, minZ: 135, maxZ: 149 };
