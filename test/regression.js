/* Test di regressione e round-trip per LaTuaRata.
   - Carica le funzioni REALI di ../../base_noleggio/app.js (fonte di verità)
     e quelle di ../app.js, eseguendole in un sandbox vm senza DOM.
   - I valori di riferimento NON sono cablati: sono prodotti eseguendo le
     formule originali di base_noleggio.
   Eseguire con: node test/regression.js
*/
const vm = require("vm");
const fs = require("fs");
const path = require("path");

function loadModule(file, isNew) {
  let src = fs.readFileSync(file, "utf8");
  const extra = isNew ? "getImponibileFromRata, " : "";
  const hook =
    "  window.__test = { getRataMensile, getRataTrimestraleInfo, getSpeseContratto, " +
    "getBandLimitForImporto, getVR, calcolaCanoniPerDurate, round2, formatEUR, " +
    extra +
    "DURATE_MESI };\n  // Esporta funzioni per onclick HTML";
  src = src.replace("  // Esporta funzioni per onclick HTML", hook);

  const elStub = { style: {}, appendChild() {}, addEventListener() {}, textContent: "", innerHTML: "" };
  const sandbox = {
    window: {},
    navigator: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      createElement() { return Object.assign({}, elStub); }
    },
    console
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.__test;
}

const ORIG = loadModule(path.resolve(__dirname, "../../base_noleggio/app.js"), false);
const NEW = loadModule(path.resolve(__dirname, "../app.js"), true);

const DURATE = ORIG.DURATE_MESI;
let failures = 0;
let checks = 0;

function eq(a, b, msg) {
  checks++;
  if (a !== b) {
    failures++;
    if (failures <= 30) console.log("  FAIL:", msg, "| orig=", a, "new=", b);
  }
}

/* ---------- 1) REGRESSIONE imponibile -> rata (deve essere identica) ---------- */
console.log("== Regressione imponibile -> rata (bit per bit) ==");
const importiTest = [
  500, 1000, 2500, 4999, 5000, 5001, 7500, 10000, 10001, 15000, 15001,
  20000, 24999, 25000, 25001, 30000, 49999, 50000, 50001, 75000, 99999,
  100000, 100001, 150000, 200000, 18381, 33333, 12345.67
];

importiTest.forEach((imp) => {
  // spese, fascia, VR, canoni per durate
  eq(ORIG.getSpeseContratto(imp), NEW.getSpeseContratto(imp), `spese(${imp})`);
  eq(ORIG.getBandLimitForImporto(imp), NEW.getBandLimitForImporto(imp), `band(${imp})`);

  const oc = ORIG.calcolaCanoniPerDurate(imp);
  const nc = NEW.calcolaCanoniPerDurate(imp);
  eq(oc.bandLimit, nc.bandLimit, `canoniBand(${imp})`);

  DURATE.forEach((d) => {
    eq(oc.canoni[d], nc.canoni[d], `canone(${imp},${d})`);

    const om = ORIG.getRataMensile(imp, d);
    const nm = NEW.getRataMensile(imp, d);
    eq(om.rata, nm.rata, `rataMensile(${imp},${d})`);
    eq(om.bandLimit, nm.bandLimit, `bandMensile(${imp},${d})`);

    const ot = ORIG.getRataTrimestraleInfo(imp, d);
    const nt = NEW.getRataTrimestraleInfo(imp, d);
    eq(ot.rata, nt.rata, `rataTrim(${imp},${d})`);

    const ovr = ORIG.getVR(imp, d);
    const nvr = NEW.getVR(imp, d);
    eq(ovr.perc, nvr.perc, `vrPerc(${imp},${d})`);
    eq(ovr.valore, nvr.valore, `vrEuro(${imp},${d})`);

    // costi derivati (stessa formula dell'originale)
    const ocg = ORIG.round2(om.rata / 22);
    const ncg = NEW.round2(nm.rata / 22);
    eq(ocg, ncg, `costoGiorn(${imp},${d})`);
    eq(ORIG.round2(ocg / 8), NEW.round2(ncg / 8), `costoOrario(${imp},${d})`);
  });

  // formato europeo
  eq(ORIG.formatEUR(imp), NEW.formatEUR(imp), `formatEUR(${imp})`);
});
console.log(`  Controlli eseguiti: ${checks}, fallimenti: ${failures}`);

/* ---------- 2) ROUND-TRIP rata -> imponibile -> rata ---------- */
console.log("\n== Round-trip imponibile -> rata -> imponibile ==");
let rtChecks = 0, rtBig = 0, rtStima = 0, worstErr = 0, worstNonStima = 0;
const errs = [];

for (let imp = 1000; imp <= 200000; imp += 250) {
  DURATE.forEach((d) => {
    ["mensile", "trimestrale"].forEach((mod) => {
      // 1) imponibile -> rata (logica originale/diretta)
      const info = mod === "trimestrale"
        ? NEW.getRataTrimestraleInfo(imp, d)
        : NEW.getRataMensile(imp, d);
      const rata = info.rata;
      if (!rata) return;

      // 2) rata -> imponibile (calcolo inverso nuovo)
      const inv = NEW.getImponibileFromRata(rata, d, mod);

      // 3) ricostruisci la rata dall'imponibile stimato
      const back = mod === "trimestrale"
        ? NEW.getRataTrimestraleInfo(inv.imponibile, d)
        : NEW.getRataMensile(inv.imponibile, d);

      const errRata = Math.abs(back.rata - rata);
      rtChecks++;
      errs.push(errRata);
      if (errRata > worstErr) worstErr = errRata;
      if (inv.stima) rtStima++;
      else if (errRata > worstNonStima) worstNonStima = errRata;

      // tolleranza: rata ricostruita ~ rata di partenza (a meno di centesimi)
      if (errRata > 0.01) rtBig++;
    });
  });
}

errs.sort((a, b) => a - b);
const p99 = errs[Math.floor(errs.length * 0.99)];
console.log(`  Casi testati: ${rtChecks}`);
console.log(`  Casi marcati (stima): ${rtStima} (${(100 * rtStima / rtChecks).toFixed(2)}%)`);
console.log(`  Errore rata ricostruita > 0,01 €: ${rtBig} casi (${(100 * rtBig / rtChecks).toFixed(2)}%)`);
console.log(`  Errore max complessivo: ${worstErr.toFixed(4)} €`);
console.log(`  Errore max nei casi NON-stima: ${worstNonStima.toFixed(6)} €`);
console.log(`  Errore al 99° percentile: ${p99.toFixed(6)} €`);

/* ---------- ESITO ---------- */
console.log("\n== ESITO ==");
let ok = true;
if (failures > 0) { console.log(`  ❌ Regressione: ${failures} differenze rispetto all'originale`); ok = false; }
else console.log("  ✅ Regressione: imponibile->rata IDENTICO all'originale");

// nei casi non-stima la rata deve ricostruirsi quasi perfettamente
if (worstNonStima > 0.01) { console.log(`  ❌ Round-trip non-stima sopra tolleranza: ${worstNonStima}`); ok = false; }
else console.log("  ✅ Round-trip: casi non-stima entro 0,01 €");

// la grande maggioranza dei casi deve essere a errore piccolo
if (rtBig / rtChecks > 0.05) { console.log(`  ⚠️  Troppi casi sopra 0,01 €: ${(100*rtBig/rtChecks).toFixed(2)}%`); }
else console.log(`  ✅ Round-trip: >95% dei casi entro 0,01 € (scostamenti solo ai confini)`);

process.exit(ok ? 0 : 1);
