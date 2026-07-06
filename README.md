# Gioco dell’Impostore

Party game in **HTML/CSS/JavaScript vanilla** ispirato al “gioco dell’impostore”: tutti i giocatori ricevono una **parola segreta**, tranne **1–3 impostori** che devono bluffare. Opzionalmente, l’impostore può ricevere un **suggerimento di contesto** (non troppo simile alla parola).

## Demo (GitHub Pages)
Dopo aver abilitato GitHub Pages (Settings → Pages), la demo sarà disponibile su:

- `https://<tuo-username>.github.io/impostore/`

> Per controllare che l’archivio parole sia pubblicato correttamente:
- `https://<tuo-username>.github.io/impostore/words.json`

---

## Funzionalità

- UI con **card centrale** e titolo “Gioco dell’impostore”
- **Tema chiaro/scuro** con toggle 🌙/☀️ (preferenza salvata in `localStorage`)
- **Musica di sottofondo** opzionale (default OFF, preferenza salvata)
- Impostazioni:
  - Numero giocatori **3–20** (default 6)
  - Numero impostori **1–3** (default 1) con vincolo **impostori ≤ ⌊giocatori / 3⌋** (massimo 3)
  - Tempo turno **01:00–60:00** (default 03:00)
- Distribuzione ruoli **uno alla volta** (passaggio del dispositivo); pulsante **Home** con conferma (nessun ritorno indietro, per non sbirciare i ruoli già visti)
  - Giocatori normali: vedono la parola
  - Impostori: vedono “Sei l’impostore” + **suggerimento di contesto** (sempre mostrato)
- Partita con **countdown**
- Fine turno → schermata “Smascherate l’impostore” → **Visualizza risultato**
- Risultato: mostra **parola** e **numeri degli impostori**
- Archivio parole/suggerimenti in **JSON** (`words.json`)
- Compatibile con **GitHub Pages**

---

## Sicurezza

- App **completamente statica**: nessun backend, nessun account, nessuna chiamata di rete esterna (solo `words.json` locale).
- I valori dinamici (parola, suggerimento, titoli delle modali) vengono inseriti nel DOM con **escape HTML**, per prevenire XSS anche con archivi parole non fidati.
- È presente una **Content Security Policy** restrittiva in `index.html` (`default-src 'self'`).

---

## Struttura del progetto

Tutti i file sono nella **root** del repository:

```
.
├── index.html
├── styles.css
├── app.js
├── words.json
├── favicon.png
└── assets/        (immagini ruoli, clessidra, musica)
```

---

## Come eseguire

### Su GitHub Pages
1. Vai su **Settings → Pages**
2. In “Build and deployment”:
   - Source: **Deploy from a branch**
   - Branch: **main** / **(root)**
3. Salva e apri l’URL generato

### In locale
L’app carica `words.json` via `fetch`, che molti browser bloccano in modalità `file://`.
Avvia quindi un server locale:

**Python**
```bash
python -m http.server 8000
```
Apri `http://localhost:8000`

**Node**
```bash
npx serve
```

---

## Parole e suggerimenti (`words.json`)

Il file `words.json` contiene un array di oggetti:

```json
[
  { "word": "Ristorante", "hint": "piatto" },
  { "word": "Aeroporto", "hint": "imbarco" }
]
```

- `word`: parola mostrata ai giocatori non impostori
- `hint`: suggerimento di contesto mostrato **sempre e solo** agli impostori
- I suggerimenti sono pensati per dare contesto senza essere sinonimi troppo diretti.

---

## Licenza

MIT License. Vedi il file `LICENSE`.
