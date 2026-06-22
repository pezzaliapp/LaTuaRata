# LaTuaRata
### Simulatore di Noleggio Operativo – allineato a BCC

**LaTuaRata** è una Progressive Web App (PWA) per il calcolo dei canoni di **noleggio operativo**.
È un clone di *Rel01_noleggio* che **mantiene invariata** la logica di calcolo dei canoni e
aggiunge **una sola funzione nuova**: il **calcolo inverso** dalla rata all'imponibile.

L'app funziona **offline**, è installabile su smartphone (iPhone/Android) e non usa alcuna
dipendenza esterna né CDN.

---

## 🔧 Funzionalità

- **Selettore di direzione** in alto — *"Cosa vuoi calcolare?"*:
  - **Ho l'imponibile → calcola la RATA** (modalità classica, default)
  - **Ho la RATA → calcola l'IMPONIBILE** (nuovo calcolo inverso)
- Selezione **durata** (12 / 18 / 24 / 36 / 48 / 60 mesi) e **modalità canone** (mensile / trimestrale)
- Calcolo automatico di: rata, spese di contratto, costo giornaliero, costo orario,
  fascia di importo, valore di riacquisto (VR), importo finanziato
- Esportazione **preventivo TXT** (in entrambe le direzioni)
- **Dark Mode**, **banner di aggiornamento PWA**, sezione **download PDF**
- Funzionamento **offline** (PWA installabile)

---

## 🆕 Nuova modalità: RATA → IMPONIBILE (calcolo inverso)

Nella modalità diretta la rata è `rata = imponibile × coefficiente(fascia, durata, modalità)`.
Il coefficiente però **dipende dalla fascia**, che a sua volta **dipende dall'imponibile**:
il calcolo inverso **non è quindi una semplice divisione**.

Per ogni fascia l'app calcola `candidato = rata / coefficiente(fascia, durata, modalità)` e
tiene il candidato che **ricade davvero dentro la sua fascia**
(`limite_inferiore < candidato ≤ limite_fascia`).

In modalità inversa viene mostrato in evidenza l'**imponibile calcolato** e vengono
**ricalcolati come verifica** tutti gli altri campi (spese, costo giornaliero/orario, VR,
importo finanziato, fascia). Il TXT riporta sia la **rata inserita** sia l'**imponibile** ricavato.

### ⚠️ Nota tecnica sulle stime ai confini di fascia

Ai confini tra fasce i coefficienti **saltano**, generando due situazioni:

- **Gap**: alcuni valori di rata non sono ottenibili da nessun imponibile esatto.
- **Sovrapposizione**: lo stesso valore di rata può derivare da due imponibili in fasce diverse.

In questi casi l'app **non inventa coefficienti intermedi**: restituisce la **stima più vicina**
e la marca in modo esplicito con l'etichetta **"(stima)"** (in UI e nel TXT).
Per tutti gli altri valori il risultato è esatto.

> La logica di calcolo dei canoni, i coefficienti, le fasce, le percentuali VR e le spese di
> contratto sono **identici all'originale**: la modalità *imponibile → rata* produce risultati
> **bit per bit uguali** a Rel01_noleggio (verificato dai test di regressione).

---

## 📱 Migliorie mobile applicate

Rispetto all'originale, sono state introdotte migliorie per l'uso su smartphone — **senza mai
toccare coefficienti, fasce o formule di calcolo**:

- **Viewport con `viewport-fit=cover`** e **safe-area** (`env(safe-area-inset-*)`) per il notch
  e l'home indicator di iPhone (lo sfondo dell'header si estende sotto il notch).
- **Niente zoom indesiderato** sui campi: font degli input portato a **16px** (sotto i 16px iOS
  Safari fa zoom automatico sul focus) e `-webkit-text-size-adjust: 100%`.
- **Tastiera numerica** sui campi importo: `inputmode="decimal"` + `pattern="[0-9.,]*"`.
- **Tap target** dei pulsanti con `min-height: 48px`.
- Meta tag PWA per **"Aggiungi a Home"**: `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `apple-touch-icon`,
  `theme-color`, `display: standalone`, `orientation: portrait`, icone `maskable`.
- **Rimosso lo script Google Analytics (gtag)**: era un riferimento a CDN esterno che
  violava il vincolo "nessuna dipendenza esterna" e poteva fallire offline.

---

## 🗄 Cache / Service Worker

- **`CACHE_NAME` univoco** per il rilascio: `latuarata_v2026_06_22`. Cambiarlo a ogni rilascio
  forza l'aggiornamento ed evita che un vecchio service worker serva un `app.js` obsoleto.
- `skipWaiting()` + `clients.claim()` e **cancellazione delle cache vecchie** all'`activate`.
- La lista `ASSETS` contiene **solo file realmente presenti su disco**. In particolare **non**
  include `libs/jspdf.umd.min.js` (file inesistente nell'originale): poiché `cache.addAll` è
  **atomico**, un singolo 404 avrebbe rotto l'installazione offline.

### Promemoria rilascio: bump del CACHE_NAME

A ogni rilascio cambia il `CACHE_NAME` per forzare l'aggiornamento sui dispositivi che hanno
già installato la PWA. C'è uno script che lo fa in automatico con la data odierna:

```bash
node scripts/bump-cache.js --check   # mostra il CACHE_NAME attuale
node scripts/bump-cache.js           # imposta latuarata_v<AAAA_MM_GG> (con suffisso _2,_3 se ripetuto in giornata)
```

Poi:
```bash
git add service-worker.js
git commit -m "release: bump CACHE_NAME"
git push origin main
```

### Test in locale (evitare la cache "incollata")

In sviluppo un vecchio service worker può servire file obsoleti dalla cache (HTML nuovo ma
pulsante/selettore non reattivi). Per evitarlo:

- Fai un **hard reload**: `Shift + Cmd + R` (macOS) / `Ctrl + F5` (Windows).
- Oppure usa una **porta dedicata** per i test.
- Per ripartire pulito: **DevTools → Application → Service Workers → Unregister**, poi
  **Application → Storage → Clear site data**.

---

## 🧪 Test

```bash
node -c app.js              # sintassi
node -c service-worker.js   # sintassi
node test/regression.js     # regressione imponibile->rata + round-trip
node test/dom.js            # wiring selettore/pulsante senza browser
```

- **Regressione**: le funzioni reali di `../base_noleggio/app.js` (fonte di verità) vengono
  eseguite in un sandbox e confrontate con quelle di LaTuaRata. La modalità *imponibile → rata*
  risulta **identica** (0 differenze su 1456 controlli; importi e durate vari, mensile/trimestrale).
- **Round-trip** *imponibile → rata → imponibile* su 1.000–200.000 €, tutte le durate, mensile e
  trimestrale: la rata si ricostruisce **entro 0,01 €** in tutti i casi; gli scostamenti
  sull'imponibile restano confinati ai **confini di fascia** (~2,7% dei casi, marcati "(stima)").
- **Wiring DOM**: selettore e pulsante reattivi, label/placeholder aggiornati al cambio direzione,
  nessun errore in console.

---

## 🗂 Struttura del progetto
```
/
├── index.html
├── style.css
├── app.js
├── service-worker.js
├── manifest.json
├── icons/
│   ├── icons_crm-192x192.png
│   └── icons_crm-512x512.png
├── data/
│   ├── Domanda_NOLEGGIO.pdf
│   ├── Modulo_firma_digitale.pdf
│   ├── Privacy_-_Attestazione_avvenuta_consegna.pdf
│   └── Scheda_prodotto_NOLEGGIO.pdf
├── test/
│   ├── regression.js
│   └── dom.js
└── scripts/
    └── bump-cache.js
```

---

## 📦 Versione

**LaTuaRata · Aprile 2026** (basata su Rel01_noleggio)

---

## 👤 Autore

**Alessandro Pezzali** — © 2025

---

## ⚖️ Disclaimer

I risultati forniti sono a scopo **simulativo**. Condizioni finali, tassi e approvazioni
dipendono dall'ente finanziatore e dall'istruttoria.
