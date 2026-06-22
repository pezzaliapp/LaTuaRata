/* =========================================================
   LaTuaRata — app.js
   - Clone di Rel01_noleggio: logica di calcolo dei canoni INVARIATA
   - Nuova funzione: calcolo INVERSO rata -> imponibile
   - Selettore di direzione in alto:
       imponibile -> rata (default)  |  rata -> imponibile
   - PWA offline, Dark Mode, banner aggiornamento, download PDF/TXT
   ========================================================= */

(function () {
  "use strict";

  // ---------- COSTANTI (INVARIATE rispetto all'originale) ----------
  const DURATE_MESI = [12, 18, 24, 36, 48, 60];

  // VR% per durata (come tabella originale: 10,5,3,1,1,1)
  const VR_PERCENT_BY_DURATION = {
    12: 10,
    18: 5,
    24: 3,
    36: 1,
    48: 1,
    60: 1
  };

  // Coefficienti MENSILI aggiornati ad Aprile 2026
  // Fasce IMPORTI (fino a): 5k, 15k, 25k, 50k, 100k, 999999
  const BCC_COEFFICIENTS_BY_BAND = {
    5000:   { 12: 0.082439, 18: 0.059311, 24: 0.046504, 36: 0.033168, 48: 0.026190, 60: 0.022041 },
    15000:  { 12: 0.082877, 18: 0.059535, 24: 0.046604, 36: 0.033134, 48: 0.026076, 60: 0.021877 },
    25000:  { 12: 0.082722, 18: 0.059386, 24: 0.046458, 36: 0.032988, 48: 0.025928, 60: 0.021725 },
    50000:  { 12: 0.082206, 18: 0.058894, 24: 0.045973, 36: 0.032505, 48: 0.025436, 60: 0.021223 },
    100000: { 12: 0.081133, 18: 0.058065, 24: 0.045278, 36: 0.031946, 48: 0.024944, 60: 0.020769 },
    999999: { 12: 0.080166, 18: 0.057338, 24: 0.044682, 36: 0.031485, 48: 0.024553, 60: 0.020418 }
  };

  // Coefficienti TRIMESTRALI aggiornati ad Aprile 2026
  const BCC_COEFFICIENTS_TRIMESTRALE_BY_BAND = {
    5000:   { 12: 0.249396, 18: 0.179481, 24: 0.140769, 36: 0.100456, 48: 0.079369, 60: 0.066831 },
    15000:  { 12: 0.250586, 18: 0.180065, 24: 0.141003, 36: 0.100309, 48: 0.078996, 60: 0.066313 },
    25000:  { 12: 0.250062, 18: 0.179579, 24: 0.140533, 36: 0.099851, 48: 0.078534, 60: 0.065844 },
    50000:  { 12: 0.248319, 18: 0.177965, 24: 0.138973, 36: 0.098329, 48: 0.077003, 60: 0.064293 },
    100000: { 12: 0.244988, 18: 0.175398, 24: 0.136824, 36: 0.096607, 48: 0.075493, 60: 0.062902 },
    999999: { 12: 0.242013, 18: 0.173163, 24: 0.134995, 36: 0.095197, 48: 0.074297, 60: 0.061830 }
  };

  const STORAGE_KEY_DARKMODE = "darkMode";

  // Nota tecnica (UI + TXT)
  const NOTA_SIM = "Coefficienti aggiornati ad Aprile 2026 — allineati al simulatore BCC (scostamenti minimi dovuti ad arrotondamenti Excel)";

  // ---------- UTILS (INVARIATE) ----------
  function $(id) {
    return document.getElementById(id);
  }

  function round2(value) {
    const n = Number(value);
    return Math.round(n * 100) / 100;
  }

  // "18.381,00 €" -> 18381
  function parseEuropeanFloat(raw) {
    if (!raw) return 0;
    let v = String(raw)
      .replace(/€/g, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")   // separatore migliaia
      .replace(",", ".");   // virgola -> punto decimale
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatEUR(value) {
    const n = Number(value) || 0;
    try {
      return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      return String(round2(n)).replace(".", ",");
    }
  }

  function safeFileNumber(value) {
    // per nome file (niente virgole/spazi)
    const n = Math.round(Number(value) || 0);
    return String(n);
  }

  function getSpeseContratto(importo) {
    if (importo < 5001) return 75;
    if (importo < 10001) return 100;
    if (importo < 25001) return 150;
    if (importo < 50001) return 225;
    return 300;
  }

  function getBandLimitForImporto(importo) {
    // prende la prima fascia "fino a" >= importo
    const bands = Object.keys(BCC_COEFFICIENTS_BY_BAND)
      .map(Number)
      .sort((a, b) => a - b);

    for (let i = 0; i < bands.length; i++) {
      if (importo <= bands[i]) return bands[i];
    }
    return bands[bands.length - 1];
  }

  function getRataTrimestraleInfo(importo, durataMesi) {
    const bandLimit = getBandLimitForImporto(importo);
    const coeff = BCC_COEFFICIENTS_TRIMESTRALE_BY_BAND[bandLimit] && BCC_COEFFICIENTS_TRIMESTRALE_BY_BAND[bandLimit][durataMesi];
    const rata = coeff ? round2(importo * coeff) : 0;
    return { rata: rata, bandLimit: bandLimit, coeff: coeff || 0 };
  }

  function getRataMensile(importo, durataMesi) {
    const bandLimit = getBandLimitForImporto(importo);
    const coeff = BCC_COEFFICIENTS_BY_BAND[bandLimit] && BCC_COEFFICIENTS_BY_BAND[bandLimit][durataMesi];
    const rata = coeff ? (importo * coeff) : 0;
    return { rata: round2(rata), bandLimit: bandLimit, coeff: coeff || 0 };
  }

  function getVR(importo, durataMesi) {
    const perc = VR_PERCENT_BY_DURATION[durataMesi] || 0;
    const valore = round2(importo * (perc / 100));
    return { perc: perc, valore: valore };
  }

  // ---------- CALCOLO INVERSO (NUOVO) ----------
  // Dati rata, durata e modalità, ricava l'imponibile.
  // Il coefficiente dipende dalla fascia, che dipende dall'imponibile stesso:
  // per ogni fascia si prova candidato = rata / coeff e si tiene quello che
  // ricade davvero dentro la sua fascia (limite_inferiore < cand <= limite_fascia).
  // Ai confini tra fasce i coefficienti saltano: in quei casi si restituisce
  // la stima più vicina, marcata come "(stima)".
  function getImponibileFromRata(rata, durataMesi, modalita) {
    const table = modalita === "trimestrale"
      ? BCC_COEFFICIENTS_TRIMESTRALE_BY_BAND
      : BCC_COEFFICIENTS_BY_BAND;

    const bands = Object.keys(table).map(Number).sort((a, b) => a - b);

    // ricostruisce la rata "diretta" da un imponibile, con lo stesso
    // arrotondamento dell'originale, per misurare l'errore di una stima.
    function rataDaImponibile(imp) {
      return modalita === "trimestrale"
        ? getRataTrimestraleInfo(imp, durataMesi).rata
        : getRataMensile(imp, durataMesi).rata;
    }

    const esatti = [];   // candidati che cadono dentro la propria fascia
    let migliore = null; // miglior stima quando nessun candidato è "esatto"

    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const lower = i === 0 ? 0 : bands[i - 1];
      const coeff = table[band] && table[band][durataMesi];
      if (!coeff) continue;

      const cand = rata / coeff;

      // candidato esatto: ricade nella fascia (lower, band]
      if (cand > lower && cand <= band) {
        esatti.push({ imponibile: cand, bandLimit: band, coeff: coeff });
      }

      // candidato vincolato alla fascia, per la stima ai confini
      let clamped = cand;
      if (clamped < lower) clamped = lower;
      if (clamped > band) clamped = band;
      const err = Math.abs(rataDaImponibile(clamped) - rata);
      if (!migliore || err < migliore.err) {
        migliore = { imponibile: clamped, bandLimit: band, coeff: coeff, err: err };
      }
    }

    if (esatti.length > 0) {
      // se più fasce sono compatibili (sovrapposizione ai confini), scegli
      // quella che ricostruisce meglio la rata inserita.
      esatti.sort((a, b) =>
        Math.abs(rataDaImponibile(a.imponibile) - rata) -
        Math.abs(rataDaImponibile(b.imponibile) - rata)
      );
      const best = esatti[0];
      return {
        imponibile: best.imponibile,
        bandLimit: best.bandLimit,
        coeff: best.coeff,
        stima: esatti.length > 1, // ambiguità ai confini -> segnala come stima
        trovato: true
      };
    }

    // nessun candidato dentro la propria fascia: gap ai confini -> stima vicina
    return {
      imponibile: migliore ? migliore.imponibile : 0,
      bandLimit: migliore ? migliore.bandLimit : getBandLimitForImporto(0),
      coeff: migliore ? migliore.coeff : 0,
      stima: true,
      trovato: false
    };
  }

  // ---------- UI EXTRA (box fascia/VR/finanziato) ----------
  function ensureExtraUI() {
    const resultsBox = document.querySelector(".results");
    if (!resultsBox) return;

    if ($("simBadge")) return; // già creato

    const wrap = document.createElement("div");
    wrap.className = "bcc-box";

    wrap.innerHTML = `
      <p class="bcc-badge" style="margin:0 0 8px 0;">
        <b id="simBadge">✅ ${NOTA_SIM}</b>
      </p>
      <p style="margin:0;">Fascia applicata: <b><span id="fasciaApplicata">—</span></b></p>
      <p style="margin:0;">Valore di riacquisto (VR): <b><span id="vrPerc">—</span>%</b> — <b><span id="vrEuro">—</span> €</b></p>
      <p style="margin:0;">Importo finanziato: <b><span id="importoFinanziato">—</span> €</b></p>
    `;

    resultsBox.appendChild(wrap);
  }

  function updateExtraUI(params) {
    if ($("fasciaApplicata")) $("fasciaApplicata").textContent = formatEUR(params.bandLimit);
    if ($("vrPerc")) $("vrPerc").textContent = formatEUR(params.vrPerc);
    if ($("vrEuro")) $("vrEuro").textContent = formatEUR(params.vrEuro);
    if ($("importoFinanziato")) $("importoFinanziato").textContent = formatEUR(params.importoFinanziato);
  }

  // ---------- DIREZIONE (selettore) ----------
  function getDirezione() {
    return $("direzione") ? $("direzione").value : "imponibile";
  }

  function aggiornaUIDirezione() {
    const dir = getDirezione();
    const label = $("labelImporto");
    const input = $("importo");
    const rowImponibile = $("imponibileRow");

    if (dir === "rata") {
      if (label) label.textContent = "Inserisci importo RATA:";
      if (input) input.placeholder = "Inserisci importo RATA";
      if (rowImponibile) rowImponibile.style.display = "";
    } else {
      if (label) label.textContent = "Inserisci imponibile:";
      if (input) input.placeholder = "Inserisci imponibile";
      if (rowImponibile) rowImponibile.style.display = "none";
    }

    // azzera il badge stima quando si cambia direzione
    const stimaBadge = $("stimaBadge");
    if (stimaBadge) stimaBadge.textContent = "";
  }

  // ---------- RENDER RISULTATI ----------
  // imponibile: valore (preciso) da cui derivare tutti i campi
  // opts: { rataInserita, stima } usati nella modalità inversa
  function renderResults(imponibile, durataMesi, modalita, opts) {
    opts = opts || {};
    const speseContratto = getSpeseContratto(imponibile);

    let rataPrincipale, bandLimit;
    if (modalita === "trimestrale") {
      const rataInfo = getRataTrimestraleInfo(imponibile, durataMesi);
      rataPrincipale = rataInfo.rata;
      bandLimit = rataInfo.bandLimit;
    } else {
      const rataInfo = getRataMensile(imponibile, durataMesi);
      rataPrincipale = rataInfo.rata;
      bandLimit = rataInfo.bandLimit;
    }

    const costoGiornaliero = round2(rataPrincipale / 22);
    const costoOrario = round2(costoGiornaliero / 8);

    const vr = getVR(imponibile, durataMesi);
    const importoFinanziato = round2(imponibile - vr.valore);

    const labelRata = $("labelRata");
    if (labelRata) labelRata.textContent = modalita === "trimestrale" ? "Rata trimestrale:" : "Rata mensile:";

    if ($("rataMensile")) $("rataMensile").textContent = formatEUR(rataPrincipale) + " €";
    if ($("speseContratto")) $("speseContratto").textContent = formatEUR(speseContratto) + " €";
    if ($("costoGiornaliero")) $("costoGiornaliero").textContent = formatEUR(costoGiornaliero) + " €";
    if ($("costoOrario")) $("costoOrario").textContent = formatEUR(costoOrario) + " €";

    updateExtraUI({
      bandLimit: bandLimit,
      vrPerc: vr.perc,
      vrEuro: vr.valore,
      importoFinanziato: importoFinanziato
    });

    // Riga imponibile (visibile solo in modalità inversa)
    const rowImponibile = $("imponibileRow");
    if (rowImponibile) {
      if (opts.modeRata) {
        rowImponibile.style.display = "";
        if ($("imponibileCalcolato")) $("imponibileCalcolato").textContent = formatEUR(round2(imponibile)) + " €";
        if ($("stimaBadge")) $("stimaBadge").textContent = opts.stima ? "(stima)" : "";
      } else {
        rowImponibile.style.display = "none";
      }
    }
  }

  // ---------- AZIONE PRINCIPALE ----------
  function calcola() {
    ensureExtraUI();

    const dir = getDirezione();
    const importoRaw = $("importo") ? $("importo").value : "";
    const valore = parseEuropeanFloat(importoRaw);

    if (!valore || valore <= 0) {
      alert(dir === "rata"
        ? "Per favore, inserisci un importo RATA valido."
        : "Per favore, inserisci un importo valido.");
      return;
    }

    const durataMesi = parseInt($("durata") ? $("durata").value : "24", 10) || 24;
    if (DURATE_MESI.indexOf(durataMesi) === -1) {
      alert("Durata non valida.");
      return;
    }

    const modalita = $("modalita") ? $("modalita").value : "mensile";

    if (dir === "rata") {
      // INVERSO: dalla rata ricava l'imponibile, poi mostra tutti i campi.
      const inv = getImponibileFromRata(valore, durataMesi, modalita);
      renderResults(inv.imponibile, durataMesi, modalita, {
        modeRata: true,
        rataInserita: valore,
        stima: inv.stima
      });
    } else {
      // DIRETTO: identico all'originale (imponibile -> rata).
      renderResults(valore, durataMesi, modalita, { modeRata: false });
    }
  }

  function calcolaCanoniPerDurate(imponibile) {
    const bandLimit = getBandLimitForImporto(imponibile);
    const coeffBand = BCC_COEFFICIENTS_BY_BAND[bandLimit];

    const result = {};
    DURATE_MESI.forEach((mesi) => {
      result[mesi] = round2(imponibile * (coeffBand[mesi] || 0));
    });

    return { canoni: result, bandLimit: bandLimit };
  }

  function generaTXT() {
    ensureExtraUI();

    const dir = getDirezione();
    const importoRaw = $("importo") ? $("importo").value : "";
    const valore = parseEuropeanFloat(importoRaw);

    if (!valore || valore <= 0) {
      alert("Inserisci un importo valido prima di generare il file TXT.");
      return;
    }

    const durataMesi = parseInt($("durata") ? $("durata").value : "24", 10) || 24;
    const modalita = $("modalita") ? $("modalita").value : "mensile";

    // Determina l'imponibile (input diretto oppure ricavato dalla rata)
    let imponibile, rataInseritaInfo = null;
    if (dir === "rata") {
      const inv = getImponibileFromRata(valore, durataMesi, modalita);
      imponibile = inv.imponibile;
      rataInseritaInfo = { rata: valore, stima: inv.stima };
    } else {
      imponibile = valore;
    }

    const speseContratto = getSpeseContratto(imponibile);
    const { canoni, bandLimit } = calcolaCanoniPerDurate(imponibile);

    let rataPrincipale, labelRataPrincipale;
    if (modalita === "trimestrale") {
      const rataInfo = getRataTrimestraleInfo(imponibile, durataMesi);
      rataPrincipale = rataInfo.rata;
      labelRataPrincipale = "Rata trimestrale";
    } else {
      const rataInfo = getRataMensile(imponibile, durataMesi);
      rataPrincipale = rataInfo.rata;
      labelRataPrincipale = "Rata mensile";
    }

    const costoGiornaliero = round2(rataPrincipale / 22);
    const costoOrario = round2(costoGiornaliero / 8);

    const vr = getVR(imponibile, durataMesi);
    const importoFinanziato = round2(imponibile - vr.valore);

    let testo = "";
    testo += "PREVENTIVO DI NOLEGGIO OPERATIVO (simulazione)\n";
    testo += "---------------------------------------------------\n\n";

    testo += `${NOTA_SIM}\n\n`;

    if (rataInseritaInfo) {
      const suffisso = rataInseritaInfo.stima ? " (stima)" : "";
      testo += `Modalità calcolo: RATA -> IMPONIBILE (calcolo inverso)${suffisso}\n`;
      testo += `Rata inserita: ${formatEUR(rataInseritaInfo.rata)} €\n`;
      testo += `Imponibile calcolato${suffisso}: ${formatEUR(round2(imponibile))} €\n`;
    } else {
      testo += `Imponibile fornitura: ${formatEUR(imponibile)} €\n`;
    }
    testo += `Fascia applicata (fino a): ${formatEUR(bandLimit)} €\n`;
    testo += `Modalità canone: ${modalita === "trimestrale" ? "Trimestrale" : "Mensile"}\n\n`;

    testo += `Durata selezionata: ${durataMesi} mesi\n`;
    testo += `${labelRataPrincipale}: ${formatEUR(rataPrincipale)} €\n`;
    testo += `Spese di contratto: ${formatEUR(speseContratto)} €\n`;
    testo += `Costo giornaliero (su base mensile): ${formatEUR(costoGiornaliero)} €\n`;
    testo += `Costo orario: ${formatEUR(costoOrario)} €\n\n`;

    testo += `Valore di riacquisto (VR): ${formatEUR(vr.perc)}% = ${formatEUR(vr.valore)} €\n`;
    testo += `Importo finanziato (imponibile - VR): ${formatEUR(importoFinanziato)} €\n\n`;

    testo += "CANONI MENSILI DISPONIBILI:\n";
    DURATE_MESI.forEach((mesi) => {
      testo += `${mesi} mesi: ${formatEUR(canoni[mesi])} €\n`;
    });

    testo += "\nDETTAGLI CONTRATTUALI:\n";
    testo += "Spese incasso RID: 4,00 € al mese\n\n";

    testo += "NOTE TECNICHE:\n";
    testo += "- " + NOTA_SIM + "\n";
    if (rataInseritaInfo && rataInseritaInfo.stima) {
      testo += "- L'imponibile è una STIMA: la rata inserita cade su un confine tra fasce di importo.\n";
    }
    testo += "- Tutti gli importi indicati sono da intendersi IVA esclusa.\n\n";

    const blob = new Blob([testo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `preventivo_noleggio_${safeFileNumber(imponibile)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  // ---------- DARK MODE ----------
  function bindDarkMode() {
    const btn = $("darkModeToggle");
    if (!btn) return;

    btn.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      localStorage.setItem(STORAGE_KEY_DARKMODE, String(document.body.classList.contains("dark-mode")));
    });

    const saved = localStorage.getItem(STORAGE_KEY_DARKMODE);
    if (saved === "true") document.body.classList.add("dark-mode");
  }

  // ---------- SERVICE WORKER ----------
  const UPDATE_MESSAGE = "🆕 App aggiornata. Ricarica per applicare la nuova versione.";

  function showUpdateBanner() {
    const banner = document.getElementById("updateBanner");
    const text   = document.getElementById("updateBannerText");
    const btn    = document.getElementById("updateBannerBtn");
    if (!banner || !text || !btn) return;

    text.textContent = UPDATE_MESSAGE;
    banner.style.display = "flex";

    btn.addEventListener("click", () => {
      window.location.reload();
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("./service-worker.js")
      .then(() => console.log("Service Worker registrato con successo!"))
      .catch((err) => console.error("Errore nella registrazione del Service Worker:", err));

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "APP_UPDATED") {
        showUpdateBanner();
      }
    });
  }

  // ---------- BOOT ----------
  document.addEventListener("DOMContentLoaded", () => {
    bindDarkMode();
    ensureExtraUI();

    const direzione = $("direzione");
    if (direzione) {
      direzione.addEventListener("change", aggiornaUIDirezione);
    }
    aggiornaUIDirezione();

    registerServiceWorker();
  });

  // Esporta funzioni per onclick HTML
  window.calcola = calcola;
  window.generaTXT = generaTXT;

})();
