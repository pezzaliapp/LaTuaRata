/* Test di wiring DOM senza browser: simula gli elementi della pagina,
   esegue app.js reale, scatena DOMContentLoaded, cambia il selettore e
   "clicca" Calcola in entrambe le direzioni. Verifica che label/placeholder
   si aggiornino e che le funzioni rispondano senza errori in console.
   Eseguire con: node test/dom.js
*/
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let errors = [];

function makeEl(id) {
  const listeners = {};
  return {
    id,
    value: "",
    placeholder: "",
    textContent: "",
    innerHTML: "",
    style: {},
    className: "",
    href: "", download: "",
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);return this._s.has(c);}, contains(c){return this._s.has(c);} },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    dispatch(ev) { (listeners[ev] || []).forEach((f) => f({ data: null })); },
    appendChild() {},
    removeChild() {},
    querySelector() { return null; }
  };
}

// Elementi richiesti dalla pagina
const ids = ["direzione", "importo", "labelImporto", "imponibileRow", "imponibileCalcolato",
  "stimaBadge", "durata", "modalita", "labelRata", "rataMensile", "speseContratto",
  "costoGiornaliero", "costoOrario", "darkModeToggle", "updateBanner", "updateBannerText",
  "updateBannerBtn", "fasciaApplicata", "vrPerc", "vrEuro", "importoFinanziato", "simBadge"];
const els = {};
ids.forEach((id) => (els[id] = makeEl(id)));
els.durata.value = "24";
els.modalita.value = "mensile";

const resultsBox = makeEl("results");
resultsBox.appendChild = () => {};

let domLoaded = [];
const sandbox = {
  window: {},
  navigator: {}, // niente serviceWorker -> registerServiceWorker esce subito
  localStorage: { getItem() { return null; }, setItem() {} },
  alert: (m) => { /* in test trattiamo l'alert come no-op tracciato */ sandbox.__lastAlert = m; },
  Blob: function () {},
  URL: { createObjectURL() { return "blob:x"; }, revokeObjectURL() {} },
  document: {
    addEventListener(ev, fn) { if (ev === "DOMContentLoaded") domLoaded.push(fn); },
    getElementById(id) { return els[id] || null; },
    querySelector(sel) { return sel === ".results" ? resultsBox : null; },
    createElement() { return makeEl("dyn"); },
    body: { appendChild() {}, removeChild() {}, classList: makeEl("b").classList }
  },
  console: {
    log() {}, error(...a) { errors.push(a.join(" ")); }, warn() {}
  }
};
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

const src = fs.readFileSync(path.resolve(__dirname, "../app.js"), "utf8");
vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox);
} catch (e) {
  console.log("❌ Errore caricando app.js:", e.message);
  process.exit(1);
}

// Simula DOMContentLoaded
domLoaded.forEach((fn) => fn());

let ok = true;
function check(cond, msg) { if (!cond) { ok = false; console.log("  ❌", msg); } else console.log("  ✅", msg); }

// 1) Funzioni esposte
check(typeof sandbox.window.calcola === "function", "window.calcola esposta");
check(typeof sandbox.window.generaTXT === "function", "window.generaTXT esposta");

// 2) Stato iniziale (direzione imponibile)
check(els.labelImporto.textContent.includes("imponibile"), "label iniziale = imponibile");

// 3) Cambio selettore -> rata: label e placeholder devono cambiare
els.direzione.value = "rata";
els.direzione.dispatch("change");
check(els.labelImporto.textContent === "Inserisci importo RATA:", "cambio selettore aggiorna label -> RATA");
check(els.importo.placeholder === "Inserisci importo RATA", "cambio selettore aggiorna placeholder -> RATA");
check(els.imponibileRow.style.display === "", "riga imponibile mostrata in modalità rata");

// 4) Click Calcola in modalità rata->imponibile
els.importo.value = "929,16"; // rata mensile 24m di un imponibile 20.000
sandbox.window.calcola();
check(els.imponibileCalcolato.textContent.length > 0 && els.imponibileCalcolato.textContent !== "0,00 €",
  "modalità rata: imponibile calcolato e mostrato (" + els.imponibileCalcolato.textContent + ")");
check(els.rataMensile.textContent.length > 0, "modalità rata: campi verifica popolati");

// 5) Torna a imponibile->rata
els.direzione.value = "imponibile";
els.direzione.dispatch("change");
check(els.labelImporto.textContent === "Inserisci imponibile:", "ritorno selettore aggiorna label -> imponibile");
check(els.imponibileRow.style.display === "none", "riga imponibile nascosta in modalità diretta");

els.importo.value = "20.000";
sandbox.window.calcola();
check(els.rataMensile.textContent === "929,16 €", "modalità diretta: rata mensile 20.000/24m = 929,16 € (" + els.rataMensile.textContent + ")");

// 6) Nessun errore in console durante l'esecuzione
check(errors.length === 0, "nessun console.error durante l'esecuzione" + (errors.length ? " -> " + errors.join("; ") : ""));

console.log("\n" + (ok ? "✅ Wiring DOM OK" : "❌ Wiring DOM con problemi"));
process.exit(ok ? 0 : 1);
