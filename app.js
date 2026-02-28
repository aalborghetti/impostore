// app.js
const $ = (sel) => document.querySelector(sel);

const STATE = {
  RULES: "rules",
  SETTINGS: "settings",
  DISTRIBUTION: "distribution",
  PLAYING: "playing",
  END_TURN: "end_turn",
  RESULT: "result",
};

// Parole caricate da words.json
let WORD_PAIRS = [];

const app = {
  view: STATE.RULES,

  players: 6,            // 3..20
  impostors: 1,          // 1..3 ma vincolato da floor(players/3)
  minutes: 3,            // 1..60

  impostorHintEnabled: true, // default abilitato

  currentPlayer: 1,
  impostorIndices: [],
  secretWord: "",
  secretHint: "",

  revealed: false,

  timerId: null,
  remainingSec: 0,
};

// -----------------------------
// Utility
// -----------------------------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMMSS(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleUniqueIndices(count, maxInclusive) {
  // ritorna array di numeri unici nel range 1..maxInclusive
  const set = new Set();
  while (set.size < count) {
    set.add(Math.floor(Math.random() * maxInclusive) + 1);
  }
  return Array.from(set).sort((a, b) => a - b);
}

// -----------------------------
// Vincoli impostori (NUOVO)
// -----------------------------
function getMaxImpostorsAllowed(players) {
  // 1/3 per difetto
  const oneThird = Math.floor(players / 3);

  // Limite UI (1..3) + sicurezza (players-1)
  const maxAllowed = Math.min(3, oneThird, players - 1);

  // minimo 1
  return Math.max(1, maxAllowed);
}

function normalizeImpostors() {
  app.impostors = clamp(app.impostors, 1, getMaxImpostorsAllowed(app.players));
}

function isImpostorCountInvalid() {
  return app.impostors > getMaxImpostorsAllowed(app.players);
}

// -----------------------------
// Caricamento words.json (GitHub Pages OK)
// -----------------------------
async function loadWords() {
  const res = await fetch("./words.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossibile caricare words.json (HTTP ${res.status})`);

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("words.json non contiene un array valido o è vuoto");
  }

  WORD_PAIRS = data
    .filter((x) => x && typeof x.word === "string" && x.word.trim())
    .map((x) => ({
      word: x.word.trim(),
      hint: (x.hint ?? "").toString().trim(),
    }));

  if (WORD_PAIRS.length === 0) throw new Error("words.json non contiene elementi validi");
}

function pickWordPair() {
  if (Array.isArray(WORD_PAIRS) && WORD_PAIRS.length) {
    return pickRandom(WORD_PAIRS);
  }
  // fallback (non dovrebbe scattare se words.json è ok)
  return { word: "Parola", hint: "Suggerimento" };
}

// -----------------------------
// Round / timer
// -----------------------------
function resetRound() {
  normalizeImpostors();

  app.currentPlayer = 1;

  const pair = pickWordPair();
  app.secretWord = pair.word;
  app.secretHint = pair.hint;

  app.impostorIndices = sampleUniqueIndices(app.impostors, app.players);
  app.revealed = false;

  stopTimer();
}

function startTimer() {
  stopTimer();
  app.remainingSec = app.minutes * 60;

  app.timerId = setInterval(() => {
    app.remainingSec = Math.max(0, app.remainingSec - 1);

    const t = $("#timerValue");
    if (t) t.textContent = formatMMSS(app.remainingSec);

    if (app.remainingSec === 0) {
      stopTimer();
      app.view = STATE.END_TURN;
      render();
    }
  }, 1000);
}

function stopTimer() {
  if (app.timerId) {
    clearInterval(app.timerId);
    app.timerId = null;
  }
}

// -----------------------------
// Tema chiaro/scuro
// -----------------------------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  $("#themeIcon").textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("impostore_theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

// -----------------------------
// Render UI
// -----------------------------
function render() {
  const root = $("#cardContent");
  if (!root) return;

  // HOME = schermata istruzioni/regole
  if (app.view === STATE.RULES) {
    root.innerHTML = `
      <h2 class="h2">Istruzioni</h2>
      <p class="p">
        Ogni giocatore riceve una <strong>parola segreta</strong>, tranne gli <strong>impostori</strong>.
        Gli impostori sanno solo di esserlo e devono bluffare.
      </p>
      <p class="p">
        Dopo la distribuzione dei ruoli, parte il timer. Alla fine si discute e si vota, poi puoi visualizzare il risultato.
      </p>
      <div class="btnbar">
        <button class="btn primary" id="goSettings">Vai alle impostazioni</button>
      </div>
      <div class="note">Passate il telefono senza far vedere lo schermo agli altri.</div>
    `;

    $("#goSettings").addEventListener("click", () => {
      app.view = STATE.SETTINGS;
      render();
    });
    return;
  }

  if (app.view === STATE.SETTINGS) {
    // forza sempre un valore valido quando si cambia numero giocatori
    normalizeImpostors();

    const invalid = isImpostorCountInvalid();
    const maxImp = getMaxImpostorsAllowed(app.players);

    root.innerHTML = `
      <h2 class="h2">Impostazioni</h2>

      <div class="row">
        <div class="label">
          <strong>Numero di giocatori</strong>
          <span>Da 3 a 20 (default 6)</span>
        </div>
        <div class="counter">
          <button class="small-btn" id="playersMinus" aria-label="Diminuisci giocatori">−</button>
          <div class="value" id="playersValue">${app.players}</div>
          <button class="small-btn" id="playersPlus" aria-label="Aumenta giocatori">+</button>
        </div>
      </div>

      <div class="row">
        <div class="label">
          <strong>
            Numero di impostori
            ${invalid ? `<span class="alert-icon" title="Valore non valido" aria-label="Alert">⚠️</span>` : ``}
          </strong>
          <span>Da 1 a 3 (default 1) — massimo 1/3 dei giocatori (per difetto). Max ora: <strong>${maxImp}</strong></span>
        </div>
        <div class="counter">
          <button class="small-btn" id="impMinus" aria-label="Diminuisci impostori">−</button>
          <div class="value" id="impValue">${app.impostors}</div>
          <button class="small-btn" id="impPlus" aria-label="Aumenta impostori">+</button>
        </div>
      </div>

      ${invalid ? `
        <div class="alert-box">
          ⚠️ Non valido: con ${app.players} giocatori, gli impostori possono essere al massimo <strong>${maxImp}</strong>.
        </div>
      ` : ``}

      <div class="row">
        <div class="label">
          <strong>Suggerimento per l’impostore</strong>
          <span>Mostra una parola di contesto solo all’impostore</span>
        </div>

        <label class="switch" title="Abilita/disabilita suggerimento">
          <input type="checkbox" id="hintToggle" ${app.impostorHintEnabled ? "checked" : ""} />
          <span class="slider"></span>
        </label>
      </div>

      <div class="row">
        <div class="label">
          <strong>Tempo a disposizione</strong>
          <span>Da 01:00 a 60:00 (default 03:00)</span>
        </div>
        <div class="counter">
          <button class="small-btn" id="timeMinus" aria-label="Diminuisci tempo">−</button>
          <div class="value" id="timeValue">${formatMMSS(app.minutes * 60)}</div>
          <button class="small-btn" id="timePlus" aria-label="Aumenta tempo">+</button>
        </div>
      </div>

      <hr />

      <div class="btnbar">
        <button class="btn primary" id="startDistribution" ${invalid ? "disabled" : ""}>Avvia distribuzione ruoli</button>
        <button class="btn soft" id="goHome">Home</button>
      </div>
    `;

    $("#playersMinus").addEventListener("click", () => {
      app.players = clamp(app.players - 1, 3, 20);
      normalizeImpostors();
      render();
    });
    $("#playersPlus").addEventListener("click", () => {
      app.players = clamp(app.players + 1, 3, 20);
      normalizeImpostors();
      render();
    });

    $("#impMinus").addEventListener("click", () => {
      app.impostors = clamp(app.impostors - 1, 1, 3);
      // qui NON normalizziamo automaticamente a maxImp? Sì: evita stati invalidi.
      normalizeImpostors();
      render();
    });
    $("#impPlus").addEventListener("click", () => {
      app.impostors = clamp(app.impostors + 1, 1, 3);
      normalizeImpostors();
      render();
    });

    $("#hintToggle").addEventListener("change", (e) => {
      app.impostorHintEnabled = !!e.target.checked;
    });

    $("#timeMinus").addEventListener("click", () => {
      app.minutes = clamp(app.minutes - 1, 1, 60);
      render();
    });
    $("#timePlus").addEventListener("click", () => {
      app.minutes = clamp(app.minutes + 1, 1, 60);
      render();
    });

    const startBtn = $("#startDistribution");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        if (isImpostorCountInvalid()) return;
        resetRound();
        app.view = STATE.DISTRIBUTION;
        render();
      });
    }

    $("#goHome").addEventListener("click", () => {
      app.view = STATE.RULES;
      render();
    });

    return;
  }

  if (app.view === STATE.DISTRIBUTION) {
    const isLastPlayer = app.currentPlayer === app.players;
    const isImpostor = app.impostorIndices.includes(app.currentPlayer);

    const roleImgSrc = isImpostor ? "./assets/impostore.png" : "./assets/giocatore.png";
    const roleImgAlt = isImpostor ? "Impostore" : "Giocatore";

    const impostorText = app.impostorHintEnabled && app.secretHint
      ? `Sei l’impostore<br><span style="font-weight:700;font-size:14px;opacity:.9;">Suggerimento: ${app.secretHint}</span>`
      : `Sei l’impostore`;

    root.innerHTML = `
      <h2 class="h2">Distribuzione ruoli</h2>

      <div class="step">
        <div class="big">Visualizza ruolo del giocatore ${app.currentPlayer}</div>
        ${app.revealed ? `
        <div class="role-illustration">
          <img src="${roleImgSrc}" alt="${roleImgAlt}" loading="eager" decoding="async">
        </div>
      
        <div class="reveal" id="revealBox">
          ${isImpostor ? impostorText : `Parola: ${app.secretWord}`}
        </div>
        ` : `
        <p class="p" style="text-align:center;">
          Premi il pulsante per vedere la parola (o il ruolo impostore).
        </p>
        `}
      </div>

      <div class="btnbar">
        ${!app.revealed ? `
          <button class="btn primary" id="showRole">Mostra</button>
          <button class="btn soft" id="goHome">Home</button>
        ` : `
          ${isLastPlayer ? `
            <button class="btn primary" id="startGame">Avvia partita</button>
          ` : `
            <button class="btn primary" id="nextPlayer">Giocatore successivo</button>
          `}
        `}
      </div>

      <div class="note">
        Passa il telefono al giocatore ${app.currentPlayer}${app.revealed ? " e poi nascondi la schermata" : ""}.
      </div>
    `;

    if (!app.revealed) {
      $("#showRole").addEventListener("click", () => {
        app.revealed = true;
        render();
      });
      $("#goHome").addEventListener("click", () => {
        resetRound();
        app.view = STATE.RULES;
        render();
      });
    } else {
      if (isLastPlayer) {
        $("#startGame").addEventListener("click", () => {
          app.view = STATE.PLAYING;
          startTimer();
          render();
        });
      } else {
        $("#nextPlayer").addEventListener("click", () => {
          app.currentPlayer += 1;
          app.revealed = false;
          render();
        });
      }
    }
    return;
  }

  if (app.view === STATE.PLAYING) {
    root.innerHTML = `
      <h2 class="h2">Partita in corso</h2>

      <div class="step">
        <div class="big">Tempo rimanente</div>
        <div class="reveal" style="font-size:22px;" id="timerValue">${formatMMSS(app.remainingSec)}</div>
      </div>

      <div class="btnbar">
        <button class="btn primary" id="endTurn">Termina turno</button>
        <button class="btn soft" id="goHome">Home</button>
      </div>

      <div class="note">Consiglio: fate un giro di descrizioni brevi della parola, poi votate.</div>
    `;

    $("#endTurn").addEventListener("click", () => {
      stopTimer();
      app.view = STATE.END_TURN;
      render();
    });

    $("#goHome").addEventListener("click", () => {
      stopTimer();
      resetRound();
      app.view = STATE.RULES;
      render();
    });

    return;
  }

  if (app.view === STATE.END_TURN) {
    root.innerHTML = `
      <h2 class="h2">Fine turno</h2>
      <div class="step">
        <div class="big">Smascherate l’impostore</div>
        <p class="p" style="text-align:center;">
          Discutete e votate. Quando siete pronti, potete visualizzare il risultato.
        </p>
      </div>

      <div class="btnbar">
        <button class="btn primary" id="showResult">Visualizza risultato</button>
        <button class="btn soft" id="goHome">Home</button>
      </div>

      <div class="note">Il risultato mostrerà la parola e i numeri dei giocatori impostori.</div>
    `;

    $("#showResult").addEventListener("click", () => {
      app.view = STATE.RESULT;
      render();
    });

    $("#goHome").addEventListener("click", () => {
      resetRound();
      app.view = STATE.RULES;
      render();
    });

    return;
  }

  if (app.view === STATE.RESULT) {
    const list = app.impostorIndices.join(", ");
    const label = app.impostorIndices.length === 1 ? "Impostore" : "Impostori";

    root.innerHTML = `
      <h2 class="h2">Risultato</h2>

      <div class="step">
        <div class="big">Parola</div>
        <div class="reveal">${app.secretWord}</div>
      </div>

      <div class="step" style="margin-top: 10px;">
        <div class="big">${label}</div>
        <div class="reveal">${list}</div>
      </div>

      <div class="btnbar">
        <button class="btn primary" id="newRound">Avvia nuovo turno</button>
        <button class="btn soft" id="goHome">Home</button>
      </div>

      <div class="note">Il nuovo turno riassegna parola e impostori usando le impostazioni correnti.</div>
    `;

    $("#newRound").addEventListener("click", () => {
      resetRound();
      app.view = STATE.DISTRIBUTION;
      render();
    });

    $("#goHome").addEventListener("click", () => {
      resetRound();
      app.view = STATE.RULES;
      render();
    });

    return;
  }
}

// -----------------------------
// Init
// -----------------------------
(async function init() {
  const savedTheme = localStorage.getItem("impostore_theme") || "light";
  applyTheme(savedTheme);
  $("#themeToggle").addEventListener("click", toggleTheme);

  try {
    await loadWords();
  } catch (e) {
    console.warn(e);
    const root = $("#cardContent");
    if (root) {
      root.innerHTML = `
        <h2 class="h2">Errore caricamento parole</h2>
        <p class="p">
          Non riesco a caricare <strong>words.json</strong>. Assicurati che sia nella root del sito (stessa cartella di index.html).
        </p>
        <div class="reveal" style="font-size:14px; text-align:left;">
          ${String(e.message || e)}
        </div>
      `;
    }
    return;
  }

  app.view = STATE.RULES;
  render();
})();
