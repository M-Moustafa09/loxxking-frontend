// Clears the previous Angular bundle out of the API's wwwroot before a new one is written.
//
// `build:backend` runs with deleteOutputPath: false, and it has to: wwwroot is not only the
// bundle. LocalFileStorageService writes customer uploads to wwwroot/uploads/**, so letting the
// builder wipe the folder would delete product images and voice notes. The cost of keeping it was
// that every deploy left its predecessor's fingerprinted chunks behind for good — 115 .js files
// had piled up, none of them referenced by index.html.
//
// So this deletes by name instead: only what the build is about to write again. Anything it does
// not recognise stays and is listed, uploads/ first among them.

import { readFileSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// One source of truth for the path: whatever `build:backend` is configured to write to.
function targetFromAngularJson() {
  const angularJson = JSON.parse(readFileSync(join(projectRoot, 'angular.json'), 'utf8'));
  const project = Object.values(angularJson.projects)[0];
  const outputPath = project?.architect?.build?.configurations?.backend?.outputPath;
  const base = typeof outputPath === 'string' ? outputPath : outputPath?.base;

  if (!base) {
    throw new Error('angular.json has no build configuration "backend" with an outputPath.');
  }

  return resolve(projectRoot, base);
}

const target = process.argv[2] ? resolve(process.argv[2]) : targetFromAngularJson();

if (!existsSync(target)) {
  console.log(`clean-wwwroot: ${target} does not exist yet — nothing to clean.`);
  process.exit(0);
}

// Emitted by the build, and rewritten by the one that follows this script.
const isBuildOutputFile = (name) =>
  /\.(js|css|map)$/i.test(name) ||
  name === 'index.html' ||
  name === 'favicon.ico' ||
  name === '3rdpartylicenses.txt';

// Copied from public/ and src/assets/ on every build. `uploads` is deliberately absent.
const buildOutputDirs = new Set(['assets', 'media']);

const removed = [];
const kept = [];

for (const entry of readdirSync(target)) {
  const path = join(target, entry);
  const isDirectory = statSync(path).isDirectory();
  const isBuildOutput = isDirectory ? buildOutputDirs.has(entry) : isBuildOutputFile(entry);

  if (isBuildOutput) {
    rmSync(path, { recursive: true, force: true });
    removed.push(entry);
  } else {
    kept.push(isDirectory ? `${entry}/` : entry);
  }
}

console.log(`clean-wwwroot: removed ${removed.length} build artefact(s) from ${target}`);
if (kept.length > 0) {
  console.log(`clean-wwwroot: kept ${kept.length} item(s) the build does not own: ${kept.join(', ')}`);
}
