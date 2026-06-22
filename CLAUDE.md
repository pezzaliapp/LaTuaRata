# Istruzioni per questo progetto (LaTuaRata)

## Messaggi di commit

- **Non aggiungere MAI** il trailer `Co-Authored-By`, né firme tipo
  "Generated with Claude Code" o simili, nei messaggi di commit.
- I messaggi di commit devono contenere **solo la descrizione della modifica**,
  niente altro.

## Vincoli di calcolo (invariabili)

- Non modificare coefficienti, fasce di importo, percentuali VR, spese di
  contratto né alcuna formula di calcolo esistente: la modalità
  *imponibile → rata* deve restare identica all'originale Rel01_noleggio.
- Se si sospetta un bug nei calcoli, segnalarlo e fermarsi: non correggerlo in autonomia.

## Rilascio PWA

- A ogni rilascio aggiornare `CACHE_NAME` in `service-worker.js`
  (vedi `scripts/bump-cache.js`).
