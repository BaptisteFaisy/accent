#!/usr/bin/env node
/**
 * Garde RNF-07 : le bundle JS initial doit rester sous 300 Ko gzip.
 * Lance `vite build` avant. Échoue (exit 1) au-delà du budget.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KO = 300;
const DIST = 'dist/assets';

function fichiers(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => join(dir, f));
  } catch {
    console.error(`dist introuvable (${dir}) : lance d'abord \`npx vite build\`.`);
    process.exit(1);
  }
}

const liste = fichiers(DIST);
let total = 0;
for (const f of liste) {
  const brut = readFileSync(f);
  const gz = gzipSync(brut).length;
  total += gz;
  console.log(`${f}  ${(statSync(f).size / 1024).toFixed(1)} Ko  →  ${(gz / 1024).toFixed(1)} Ko gzip`);
}
const ko = total / 1024;
console.log(`TOTAL JS initial : ${ko.toFixed(1)} Ko gzip (budget ${BUDGET_KO} Ko)`);
if (ko > BUDGET_KO) {
  console.error('BUDGET DÉPASSÉ');
  process.exit(1);
}
console.log('BUDGET OK');
