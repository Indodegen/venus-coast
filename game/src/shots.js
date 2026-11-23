// shots.js — staged, deterministic camera poses for the 4 screenshots.
// Compositions follow Kairo's 4 reference images as closely as three.js low-poly allows:
// big red car center-frame, low camera behind the car, heli WHOLE inside the frame
// with spotlight on, police cars clearly chasing, bright readable roads.
// Real game state, real HUD. Dialog never overlaps any other panel.
import * as THREE from 'three';

function placeCar(player, x, z, heading, groundY) {
  player.x = x; player.z = z; player.heading = heading; player.speed = 0;
  player.y = groundY(x, z);
}
function placePolice(police, spots, groundY) {
  police.cars.forEach((c, i) => {
    const s = spots[i % spots.length];
    c.group.position.set(s.x, groundY(s.x, s.z), s.z);
    c.group.rotation.y = s.h;
    c.heading = s.h;
    c.speed = 0;
  });
}
function placeHeli(police, x, y, z) {
  if (!police.heli) return;
  const h = police.heli.group;
  h.position.set(x, y, z);
  h.rotation.y = 0.6;
}

function aim(ctx, camera, px, py, pz, lx, ly, lz) {
  camera.position.set(px, py, pz);
  const look = new THREE.Vector3(lx, ly, lz);
  camera.lookAt(look);
  ctx.lookTarget = look; // recorded so a driving shot can track the same framing
}

export function stageShot(n, ctx) {
  const { camera, player, police, groundY, setDialog, setStage } = ctx;
  if (n === 1) {
    // PIER ESCAPE — sunset beach road (ref 1): car big center, ocean right,
    // palms left, heli top-center with spotlight, 2 police chasing behind.
    setStage(1);
    placeCar(player, -38, 160, Math.PI / 2, groundY);
    placePolice(police, [
      { x: -16, z: 168, h: Math.PI / 2 },
      { x: -4, z: 152, h: Math.PI / 2 },
    ], groundY);
    placeHeli(police, -14, 9, 166);
    aim(ctx, camera, -50, 4.2, 153, -28, 2.2, 161);
    setDialog('Stick to the shoreline, kid. The pier is one block west.');
  } else if (n === 2) {
    // REPO RODEO — dusk (ref 2): rear 3/4, car center, orange-white barriers +
    // police cars forming the roadblock ahead, heli top-left with spotlight.
    setStage(1);
    placeCar(player, 14, 0, Math.PI / 2, groundY);
    placePolice(police, [
      { x: -8, z: 0, h: Math.PI / 2 },
      { x: -18, z: 4, h: Math.PI / 2 },
      { x: -18, z: -4, h: Math.PI / 2 },
    ], groundY);
    placeHeli(police, 22, 11, 4);
    aim(ctx, camera, -4, 3.4, -8, 20, 2, 0);
    setDialog("They're locking down the intersection. Drift through the gas station alley.");
  } else if (n === 3) {
    // MARINA GETAWAY — golden hour (ref 4): camera NORTH of the bridge, HIGH,
    // looking SOUTH-EAST across the deck — car big center-low, canal water +
    // yacht hull beyond the deck, golden sun low over the southern sea.
    // (The old south-side camera could never show the sun — it sat behind it —
    // and the low angle hid every hull behind the 6m deck. The high north
    // camera clears the south guardrail: the sightline to the (134,60) hull
    // passes z=38 at y≈8.7, above the 7.75m rail top.)
    setStage(3);
    placeCar(player, 122, 30, Math.PI / 2, groundY);
    placePolice(police, [
      { x: 114, z: 28, h: Math.PI / 2 },
      { x: 116, z: 34, h: Math.PI / 2 },
      { x: 131, z: 26, h: Math.PI / 2 },
      { x: 137, z: 32, h: Math.PI / 2 },
    ], groundY);
    placeHeli(police, 128, 15.6, 46);
    aim(ctx, camera, 116, 15.6, 18, 128, 2.0, 50);
    setDialog("The slip is ready. Keep the engine straight and don't hit the fuel pumps.");
  } else {
    // NOCTURNAL HEAT — neon night (ref 3): rear 3/4, car center, 6 police cars
    // ahead in a STAGGERED line (so all 6 read instead of hiding behind each other),
    // heli top-center with spotlight, neon signs.
    setStage(1);
    placeCar(player, -40, -160, Math.PI / 2, groundY);
    placePolice(police, [
      { x: -30, z: -158, h: Math.PI / 2 },
      { x: -18, z: -163, h: Math.PI / 2 },
      { x: -6, z: -157, h: Math.PI / 2 },
      { x: 6, z: -163, h: Math.PI / 2 },
      { x: 18, z: -157, h: Math.PI / 2 },
      { x: 30, z: -163, h: Math.PI / 2 },
    ], groundY);
    placeHeli(police, -8, 22, -138);
    aim(ctx, camera, -54, 3.2, -167, -16, 2, -158);
    setDialog('The alley behind the club cuts their line of sight. Move now.');
  }
  camera.updateProjectionMatrix();
}

// stageGarage — pose for the garage preview screenshot: the REDFIRE V8 parked
// on the BAY AUTO pad (marina lot edge), camera SOUTH-EAST of the pad on the
// beach road, looking NORTH-WEST past the car. The GARAGE neon sign faces
// south (FrontSide), so it is only visible from z>149.6 — the old north-side
// camera saw just its back face and the car sat half out of the left edge.
// This framing reads the sign top-center and the whole car mid-right, both
// clear of the centered garage overlay box and every HUD panel.
export function stageGarage(ctx) {
  const { camera, player, police, groundY, setDialog, setStage } = ctx;
  setStage(4);
  placeCar(player, 196, 142, Math.PI / 2, groundY);
  placePolice(police, [
    { x: 178, z: 120, h: Math.PI / 2 },
    { x: 186, z: 128, h: Math.PI / 2 },
  ], groundY);
  placeHeli(police, 200, 18, 118);
  aim(ctx, camera, 218, 9, 160, 204, 1, 159);
  setDialog("The slip is ready. Keep the engine straight and don't hit the fuel pumps.");
  camera.updateProjectionMatrix();
}
