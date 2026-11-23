// missions.js — 4 locked story jobs. Order fixed. Checkpoints are real world coords.
// Fixer names, radios, dispatch unit names and dialog lines follow Kairo's reference images.
export const MISSIONS = [
  {
    id: 1, name: 'PIER ESCAPE', tag: 'JOB 1/4 — PIER ESCAPE',
    objective: 'Lose the heat and reach the boat',
    timeOfDay: 0, wanted: 2, reward: 500, timer: 180,
    start: { x: 0, z: -40, heading: 0 }, // facing +z (south, toward beach)
    policeCars: 2, heli: true, heliName: 'AIR ONE',
    units: [
      { name: 'TARPON 38', action: 'RAMMING' },
      { name: 'VIPER 31', action: 'FIRING' },
    ],
    fixer: { name: 'Uncle Dee', initial: 'D' },
    dialog: 'Stick to the shoreline, kid. The pier is one block west.',
    stages: [
      { x: 0, z: 80, label: 'Beach road checkpoint', dialog: 'Stick to the shoreline, kid. The pier is one block west.' },
      { x: 0, z: 150, label: 'Beachfront', dialog: 'Beachfront ahead — don\'t let them box you in.' },
      { x: 0, z: 250, label: 'End of the pier', dialog: 'End of the pier. The boat is waiting — go, go!' },
    ],
  },
  {
    id: 2, name: 'REPO RODEO', tag: 'JOB 2/4 — REPO RODEO',
    objective: 'Wreck the Regent before it escapes',
    timeOfDay: 1, wanted: 3, reward: 750, timer: 180,
    start: { x: -160, z: 0, heading: Math.PI / 2 }, // facing +x (east)
    policeCars: 3, heli: true, heliName: 'AIR WING 04',
    units: [
      { name: 'BARRACUDA', action: 'FIRING' },
      { name: 'MAKO 22', action: 'RAMMING' },
      { name: 'PHANTOM 18', action: 'FLANKING' },
    ],
    roadblock: { x: 40, z: 0 }, // police wall + striped barriers across the east road
    roadblockUnits: ['RAMPART 09', 'BULWARK 2', 'BLOCKADE 14'],
    fixer: { name: 'Tia Rosa', initial: 'R' },
    dialog: "They're locking down the intersection. Drift through the gas station alley.",
    stages: [
      { x: -80, z: 0, label: 'Downtown', dialog: "They're locking down the intersection. Drift through the gas station alley." },
      { x: 80, z: 0, label: 'Past the roadblock', dialog: 'Roadblock ahead — punch through or slip around the side street.' },
      { x: 160, z: -80, label: 'Repo lot', dialog: 'Repo lot in sight. Grab the Regent and vanish.' },
    ],
  },
  {
    id: 3, name: 'MARINA GETAWAY', tag: 'JOB 3/4 — MARINA GETAWAY',
    objective: 'Deliver the car to the contact at the docks',
    timeOfDay: 2, wanted: 4, reward: 1000, timer: 240,
    start: { x: -160, z: 0, heading: Math.PI / 2 }, // facing +x (east)
    policeCars: 4, heli: true, heliName: 'EAGLE EYE 07',
    units: [
      { name: 'MAKO 22', action: 'RAMMING' },
      { name: 'VIPER 31', action: 'FIRING' },
      { name: 'PHANTOM 18', action: 'FLANKING' },
      { name: 'TARPON 38', action: 'RAMMING' },
    ],
    fixer: { name: 'Marco', initial: 'M' },
    dialog: "The slip is ready. Keep the engine straight and don't hit the fuel pumps.",
    stages: [
      { x: 60, z: 0, label: 'Bridge approach', dialog: "The slip is ready. Keep the engine straight and don't hit the fuel pumps." },
      { x: 60, z: 30, label: 'Bridge ramp', dialog: 'Bridge ramp coming up — commit to it.' },
      { x: 122, z: 30, label: 'Mid-bridge', dialog: 'Mid-bridge — no turning back now.' },
      { x: 185, z: 30, label: 'Far side', dialog: 'Far side — the docks are close.' },
      { x: 210, z: 120, label: 'Marina lot', dialog: 'Marina lot. Deliver the car to the contact.' },
    ],
  },
  {
    id: 4, name: 'NOCTURNAL HEAT', tag: 'JOB 4/4 — NOCTURNAL HEAT',
    objective: 'Lose the final wanted level and escape the city',
    timeOfDay: 3, wanted: 5, reward: 1500, timer: 240,
    start: { x: 210, z: 120, heading: Math.PI }, // facing -z (north)
    policeCars: 6, heli: true, heliName: 'NIGHTHAWK 02',
    units: [
      { name: 'VIPER 31', action: 'FIRING' },
      { name: 'PHANTOM 18', action: 'FLANKING' },
      { name: 'MAKO 22', action: 'RAMMING' },
      { name: 'TARPON 38', action: 'RAMMING' },
      { name: 'BARRACUDA', action: 'FIRING' },
      { name: 'COBRA 12', action: 'FLANKING' },
    ],
    fixer: { name: 'Juno', initial: 'J' },
    dialog: 'The alley behind the club cuts their line of sight. Move now.',
    stages: [
      { x: 160, z: -80, label: 'North district', dialog: 'The alley behind the club cuts their line of sight. Move now.' },
      { x: 0, z: -160, label: 'Uptown', dialog: 'Uptown. Two blocks to the safehouse.' },
      { x: -160, z: -160, label: 'Safehouse', dialog: 'Safehouse ahead — lose them first, then slip in.' },
    ],
  },
];

export const RESPECT_NAMES = ['ROOKIE', 'HUSTLER', 'RUNNER', 'FIXER', 'LEGEND'];
export const RADIO = [
  'LUMEN FM 98.6 — NEON TIDELINE',
  'GUAVA SUNRISE 102.3 — TROPICAL RIOT',
  'SHORELINE ROCK — HEATWAVE',
  'NEON BEAT FM 99.9 — MIDNIGHT CHASE',
];
export const CAR_NAME = 'REDFIRE V8';
