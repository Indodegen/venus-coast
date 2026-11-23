// main.ts — VENUS COAST entry file for make.fun gta6-01.
// Copies the playable game (game/) and the 4 staged gameplay screenshots
// (screenshots/) into the make.fun output directory and writes a manifest
// + dossier describing the entry. Written fresh for this build.
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(root, 'out');
const ENTRY_DIRS = ['game', 'screenshots'];

async function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(p, base));
    else out.push(p);
  }
  return out;
}

async function sha256(file) {
  const h = createHash('sha256');
  await new Promise((resolve, reject) => {
    createReadStream(file).on('data', (d) => h.update(d)).on('end', resolve).on('error', reject);
  });
  return h.digest('hex');
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const manifest = { name: 'VENUS COAST', competition: 'gta6-01', files: [] };

  // one place owns copying a single entry dir (game/ or screenshots/) into
  // the output and recording its manifest entries (was the whole loop body
  // inline in main(), so a second dir meant re-reading the same logic)
  async function copyEntryDir(sub) {
    const srcDir = join(root, sub);
    const files = await listFiles(srcDir);
    const entries = [];
    for (const f of files) {
      const rel = join(sub, f.slice(srcDir.length + 1));
      const dest = join(outDir, rel);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(f, dest);
      const size = (await stat(f)).size;
      entries.push({ path: rel, bytes: size, sha256: await sha256(f) });
    }
    return entries;
  }

  for (const sub of ENTRY_DIRS) {
    manifest.files.push(...await copyEntryDir(sub));
  }

  const dossier = {
    name: 'VENUS COAST',
    tagline: 'open-world crime at sunset — 4 story getaway jobs, dynamic police dispatch with roadblocks, spotlight & ramming, crew fixer dialogue, vehicle condition system, weapon slots, respect rank, radio station. New: title menu with save/load, crew abilities (Swap Plates / Quick Fix / Eyes Out), Bay Auto garage (repaint + body armor).',
    competition: 'gta6-01',
    engine: 'three.js (vendored three.module.min.js, low-poly cel-shaded)',
    missions: [
      '1 · PIER ESCAPE — sunset, heli spotlight, reach the pier',
      '2 · REPO RODEO — dusk, police roadblock, steal the repo car',
      '3 · MARINA GETAWAY — golden hour, chase across the marina bridge',
      '4 · NOCTURNAL HEAT — neon night, 5 stars, reach the safehouse',
    ],
    features: [
      'Title main menu: NEW GAME / CONTINUE (load save) / CONTROLS / GARAGE, auto-save after every mission',
      'Crew abilities: SWAP PLATES (Z, $150), QUICK FIX (X, $200, 45s cooldown), EYES OUT (C, $100)',
      'Bay Auto garage: repaint the REDFIRE V8 + body armor upgrades (max condition up to 175, damage reduction up to 45%)',
    ],
    controls: 'WASD drive, SPACE handbrake, 1-4 weapons, CLICK shoot, Z/X/C crew abilities, G garage (in the Bay Auto zone), R radio',
    screenshots: ['screenshots/1-pier.jpg', 'screenshots/2-repo.jpg', 'screenshots/3-marina.jpg', 'screenshots/5-title-menu.jpg'],
    hud_lock: 'minimap bottom-left; dispatch middle-left [UNIT | distance m | ACTION]; objective top-left; fixer dialog bottom-center; weapon slots middle-right; wanted + money top-right; vehicle status bottom-right; radio under speedometer',
  };

  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(outDir, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n');
  console.log(`VENUS COAST packaged: ${manifest.files.length} files -> ${outDir}`);
  console.log(`screenshots: ${manifest.files.filter((f) => f.path.startsWith('screenshots/')).map((f) => basename(f.path)).join(', ')}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
