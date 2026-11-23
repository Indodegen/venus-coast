# VENUS COAST

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Indodegen/venus-coast/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/Indodegen/venus-coast/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard)

**VENUS COAST: open-world crime at sunset — 4 story getaway jobs, dynamic police dispatch with roadblocks, spotlight & ramming, crew fixer dialogue, vehicle condition system, weapon slots, respect rank, radio station.**

A low-poly cel-shaded 3D open-world crime game in the spirit of GTA Vice City — tropical coastal city, palm trees, beach roads, a red muscle car, police cars and a spotlight helicopter. Built with three.js (vendored, works offline).

## The 4 jobs

1. **PIER ESCAPE** — sunset. Outrun the heat to the end of the pier while the helicopter spotlight tracks you.
2. **REPO RODEO** — dusk. Punch through (or slip around) a police roadblock and steal the repo car.
3. **MARINA GETAWAY** — golden hour. Lose the chase across the marina bridge.
4. **NOCTURNAL HEAT** — neon night. 5 wanted stars, the heaviest pursuit, reach the safehouse.

## Controls

- **WASD** drive · **SPACE** handbrake · **1–4** weapons (Fists, Bat, Pistol, SMG) · **CLICK** shoot
- **Z** Swap Plates ($150) · **X** Quick Fix ($200) · **C** Eyes Out ($100) — crew abilities, each with a cooldown
- **G** open the Bay Auto garage (drive into the garage zone at the marina lot)
- The radio station is fixed per job (it changes when the next job starts); there is no radio key.

## New features

- **Title main menu** — NEW GAME, CONTINUE (loads the auto-save), CONTROLS, GARAGE. The game auto-saves after every completed mission (position, money, respect rank, weapons).
- **Crew Ability panel** (right side, under the weapon slots) — SWAP PLATES hides the plates so police recognize you slower and wanted drops, QUICK FIX instantly repairs body + armor (45s cooldown), EYES OUT has the crew spotter mark police, roadblocks and the helicopter on the minimap.
- **Bay Auto garage** — repaint the REDFIRE V8 (6 colors, $100) and upgrade body armor up to LV 3 (max condition 175, up to 45% less damage). Open it from the main menu or by driving into the garage zone at the marina lot and pressing G.

## Save file

The game auto-saves after every completed mission (and after garage purchases) to `localStorage` key `venus-coast-save-v1`: next job, money, respect rank, weapons + ammo, paint color and body armor level, and the player's position. CONTINUE on the title menu loads it; NEW GAME clears it.

## HUD (locked layout)

Minimap bottom-left · police dispatch middle-left (`UNIT | distance m | ACTION`) · mission objective top-left · fixer dialogue bottom-center · weapon slots middle-right · wanted stars + money top-right · vehicle status (speed, condition, armor, health) bottom-right · radio station under the speedometer.

## Play

```bash
node serve.ts        # then open http://localhost:8931/game/
```

Or open `game/index.html` from any static server. Entry point for the make.fun harness: `main.ts` (packages `game/` + `screenshots/` into `MAKEFUN_OUTPUT_DIR`).

## Screenshots

All four previews are real gameplay from this build — every HUD element in the pictures exists in the game.

- `screenshots/1-pier.jpg` — Pier Escape (sunset, heli spotlight)
- `screenshots/2-repo.jpg` — Repo Rodeo (dusk, roadblock)
- `screenshots/3-marina.jpg` — Marina Getaway (golden hour, marina bridge)
- `screenshots/6-crew-chase.jpg` — Nocturnal Heat chase with EYES OUT active (gold minimap rings)

The title menu and garage workshop are described in this README and playable in the game.
