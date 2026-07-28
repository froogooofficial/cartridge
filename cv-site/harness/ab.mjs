// Blind A/B: stage two candidate captures as unlabeled A.png / B.png with a randomized
// mapping, and write the key somewhere the critic is never pointed at.
//
//   node harness/ab.mjs <leftPng> <rightPng> <outDir> [leftName] [rightName]
//
// Prints ONLY the two staged paths. The key goes to <outDir>/../.ab-key-<n>.json,
// deliberately outside outDir so a critic listing its own directory cannot find it.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { randomInt } from 'node:crypto';

const [left, right, outDir, leftName = 'left', rightName = 'right'] = process.argv.slice(2);
if (!left || !right || !outDir) {
  console.error('usage: ab.mjs <leftPng> <rightPng> <outDir> [leftName] [rightName]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const flip = randomInt(2) === 1;
const aSrc = flip ? right : left;
const bSrc = flip ? left : right;
const aName = flip ? rightName : leftName;
const bName = flip ? leftName : rightName;

const aPath = join(outDir, 'A.png');
const bPath = join(outDir, 'B.png');
await copyFile(aSrc, aPath);
await copyFile(bSrc, bPath);

await writeFile(
  join(dirname(outDir), `.ab-key-${basename(outDir)}.json`),
  JSON.stringify({ A: aName, B: bName, aSrc, bSrc }, null, 2)
);

console.log(JSON.stringify({ A: aPath, B: bPath }, null, 2));
