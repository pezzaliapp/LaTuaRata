#!/usr/bin/env node
/* Promemoria/utility per il rilascio di LaTuaRata.
 *
 * Aggiorna CACHE_NAME in service-worker.js alla data odierna, così i
 * dispositivi che hanno già installato la PWA scaricano la nuova versione
 * (all'activate il SW cancella le cache vecchie e mostra il banner di update).
 *
 * Uso:
 *   node scripts/bump-cache.js          # imposta latuarata_v<AAAA_MM_GG>
 *   node scripts/bump-cache.js --check  # mostra solo il CACHE_NAME attuale
 *
 * Se nello stesso giorno esiste già quel nome, aggiunge un suffisso _2, _3, ...
 */
const fs = require("fs");
const path = require("path");

const SW = path.resolve(__dirname, "..", "service-worker.js");
const RE = /const CACHE_NAME = "([^"]+)";/;

function readSW() {
  const src = fs.readFileSync(SW, "utf8");
  const m = src.match(RE);
  if (!m) {
    console.error("❌ CACHE_NAME non trovato in service-worker.js");
    process.exit(1);
  }
  return { src, current: m[1] };
}

const { src, current } = readSW();

if (process.argv.includes("--check")) {
  console.log("CACHE_NAME attuale:", current);
  process.exit(0);
}

const now = new Date();
const stamp =
  now.getFullYear() +
  "_" + String(now.getMonth() + 1).padStart(2, "0") +
  "_" + String(now.getDate()).padStart(2, "0");

let next = "latuarata_v" + stamp;
if (current === next) {
  // già rilasciato oggi: aggiungi/incrementa un contatore
  next = next + "_2";
} else if (current.startsWith(next + "_")) {
  const n = parseInt(current.slice((next + "_").length), 10) || 1;
  next = next + "_" + (n + 1);
}

if (current === next) {
  console.log("Nessuna modifica: CACHE_NAME è già", current);
  process.exit(0);
}

fs.writeFileSync(SW, src.replace(RE, `const CACHE_NAME = "${next}";`));
console.log("✅ CACHE_NAME aggiornato:");
console.log("   " + current + "  ->  " + next);
console.log("\nProssimi passi:");
console.log("   git add service-worker.js");
console.log('   git commit -m "release: bump CACHE_NAME a ' + next + '"');
console.log("   git push origin main");
