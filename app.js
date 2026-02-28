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

let WORD_PAIRS = [];

const app = {
  view: STATE.RULES,
  players: 6,
  impostors: 1,
  minutes: 3,

  impostorHintEnabled: true,

  currentPlayer: 1,
  impostorIndices: [],
  secretWord: "",
  secretHint: "",
  revealed: false,

  timerId: null,
  remainingSec: 0,
};

// --- Background music (default OFF) ---
const bgm = new Audio("./assets/spy-theme.mp3");
bgm.loop = true;
bgm.volume = 0.18; // basso

let bgmEnabled = false; // DEFAULT: gioco parte senza audio

async function setBgmEnabled(on) {
  bgmEnabled = on;
  const icon = document.querySelector("#musicIcon");
  if (icon) icon.textContent = bgmEnabled ? "🔈" : "🔇";

  if (!bgmEnabled) {
    try { bgm.pause(); } catch {}
    return;
  }

  // play() deve avvenire dentro un gesto utente → qui siamo nel click handler
  try {
    await bgm.play();
  } catch {
    // se il browser blocca per qualche motivo, resterà OFF visivamente? no:
    // lasciamo ON e riproverà al prossimo click (oppure puoi revertire a OFF)
  }
}

// ---------- utils ----------
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pad2 = (n) => String(n).padStart(2, "0");
const formatMMSS = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

function sampleUniqueIndices(count, maxInclusive) {
  const set = new Set();
  while (set.size < count) set.add(Math.floor(Math.random() * maxInclusive) + 1);
  return [...set].sort((a, b) => a - b);
}

// ---------- impostors max = floor(players/3), cap 3 ----------
function getMaxImpostorsAllowed(players) {
  const oneThird = Math.floor(players / 3);
  const maxAllowed = Math.min(3, oneThird, players - 1);
  return Math.max(1, maxAllowed);
}
function normalizeImpostors() {
  app.impostors = clamp(app.impostors, 1, getMaxImpostorsAllowed(app.players));
}
function isImpostorCountInvalid() {
  return app.impostors > getMaxImpostorsAllowed(app.players);
}

// ---------- words.json ----------
async function loadWords() {
  const res = await fetch("./words.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossibile caricare words.json (HTTP ${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new Error("words.json vuoto o non valido");

  WORD_PAIRS = data
    .filter(x => x && typeof x.word === "string" && x.word.trim())
    .map(x => ({ word: x.word.trim(), hint: (x.hint ?? "").toString().trim() }));

  if (!WORD_PAIRS.length) throw new Error("words.json non contiene elementi validi");
}
function pickWordPair() {
  return WORD_PAIRS.length ? pickRandom(WORD_PAIRS) : { word: "Parola", hint: "Suggerimento" };
}

// ---------- round/timer ----------
function stopTimer() {
  if (app.timerId) clearInterval(app.timerId);
  app.timerId = null;
}
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

// ---------- theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  $("#themeIcon").textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("impostore_theme", theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

// ---------- render ----------
function render() {
  const root = $("#cardContent");
  if (!root) return;

  if (app.view === STATE.RULES) {
    root.innerHTML = `
      <h2 class="h2">Istruzioni</h2>
      <p class="p">
        Ogni giocatore riceve una <strong>parola segreta</strong>, tranne gli <strong>impostori</strong>.
        Gli impostori devono bluffare.
      </p>
      <div class="btnbar">
        <button class="btn primary" id="goSettings">Vai alle impostazioni</button>
      </div>
    `;
    $("#goSettings").addEventListener("click", () => { app.view = STATE.SETTINGS; render(); });
    return;
  }

  if (app.view === STATE.SETTINGS) {
    normalizeImpostors();
    const invalid = isImpostorCountInvalid();
    const maxImp = getMaxImpostorsAllowed(app.players);

    root.innerHTML = `
      <h2 class="h2">Impostazioni</h2>

      <div class="row">
        <div class="label"><strong>Numero di giocatori</strong><span>3–20</span></div>
        <div class="counter">
          <button class="small-btn" id="playersMinus">−</button>
          <div class="value">${app.players}</div>
          <button class="small-btn" id="playersPlus">+</button>
        </div>
      </div>

      <div class="row">
        <div class="label">
          <strong>Numero di impostori ${invalid ? `<span class="alert-icon">⚠️</span>` : ""}</strong>
          <span>1–3, max 1/3 giocatori. Max ora: <strong>${maxImp}</strong></span>
        </div>
        <div class="counter">
          <button class="small-btn" id="impMinus">−</button>
          <div class="value">${app.impostors}</div>
          <button class="small-btn" id="impPlus">+</button>
        </div>
      </div>

      ${invalid ? `<div class="alert-box">Con ${app.players} giocatori, max impostori: <strong>${maxImp}</strong>.</div>` : ""}

      <div class="row">
        <div class="label"><strong>Suggerimento per l’impostore</strong><span>Mostra contesto all’impostore</span></div>
        <label class="switch">
          <input type="checkbox" id="hintToggle" ${app.impostorHintEnabled ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="row">
        <div class="label"><strong>Tempo</strong><span>1–60 min</span></div>
        <div class="counter">
          <button class="small-btn" id="timeMinus">−</button>
          <div class="value">${formatMMSS(app.minutes * 60)}</div>
          <button class="small-btn" id="timePlus">+</button>
        </div>
      </div>

      <hr />

      <div class="btnbar">
        <button class="btn primary" id="startDistribution" ${invalid ? "disabled" : ""}>Avvia distribuzione ruoli</button>
        <button class="btn soft" id="goHome">Home</button>
      </div>
    `;

    $("#playersMinus").addEventListener("click", () => { app.players = clamp(app.players - 1, 3, 20); normalizeImpostors(); render(); });
    $("#playersPlus").addEventListener("click", () => { app.players = clamp(app.players + 1, 3, 20); normalizeImpostors(); render(); });

    $("#impMinus").addEventListener("click", () => { app.impostors = clamp(app.impostors - 1, 1, 3); normalizeImpostors(); render(); });
    $("#impPlus").addEventListener("click", () => { app.impostors = clamp(app.impostors + 1, 1, 3); normalizeImpostors(); render(); });

    $("#hintToggle").addEventListener("change", (e) => { app.impostorHintEnabled = !!e.target.checked; });

    $("#timeMinus").addEventListener("click", () => { app.minutes = clamp(app.minutes - 1, 1, 60); render(); });
    $("#timePlus").addEventListener("click", () => { app.minutes = clamp(app.minutes + 1, 1, 60); render(); });

    const startBtn = $("#startDistribution");
    if (startBtn) startBtn.addEventListener("click", () => { if (!isImpostorCountInvalid()) { resetRound(); app.view = STATE.DISTRIBUTION; render(); } });

    $("#goHome").addEventListener("click", () => { app.view = STATE.RULES; render(); });
    return;
  }

  if (app.view === STATE.DISTRIBUTION) {
    const isLastPlayer = app.currentPlayer === app.players;
    const isImpostor = app.impostorIndices.includes(app.currentPlayer);

    const roleImg = isImpostor ? "./assets/impostore.webp" : "./assets/giocatore.webp";
    const roleAlt = isImpostor ? "Impostore" : "Giocatore";

    const impostorText = app.impostorHintEnabled && app.secretHint
      ? `Sei l’impostore<br><span style="font-weight:700;font-size:14px;opacity:.9;">Suggerimento: ${app.secretHint}</span>`
      : `Sei l’impostore`;

    root.innerHTML = `
      <h2 class="h2">Distribuzione ruoli</h2>

      <div class="step">
        <div class="big">Visualizza ruolo del giocatore ${app.currentPlayer}</div>

        ${app.revealed ? `
  <div class="role-illustration">
    <img src="${roleImg}" alt="${roleAlt}" loading="eager" decoding="async">
  </div>
  <div class="reveal">${isImpostor ? impostorText : `Parola: ${app.secretWord}`}</div>
` : `
  <div class="role-illustration">
    <img src="./assets/question.webp" alt="Punto interrogativo" loading="eager" decoding="async">
  </div>
  <p class="p" style="text-align:center; margin-top:18px;">Premi “Mostra” per vedere il ruolo.</p>
`}

      </div>

      <div class="btnbar">
        ${!app.revealed ? `
          <button class="btn primary" id="showRole">Mostra</button>
        ` : `
          ${isLastPlayer ? `
            <button class="btn primary" id="startGame">Avvia partita</button>
          ` : `
            <button class="btn primary" id="nextPlayer">Giocatore successivo</button>
          `}
        `}
      </div>
    `;

    if (!app.revealed) {
      $("#showRole").addEventListener("click", () => { app.revealed = true; render(); });
    } else {

      if (isLastPlayer) {
        $("#startGame").addEventListener("click", () => { app.view = STATE.PLAYING; startTimer(); render(); });
      } else {
        $("#nextPlayer").addEventListener("click", () => { app.currentPlayer += 1; app.revealed = false; render(); });
      }
    }
    return;
  }

  if (app.view === STATE.PLAYING) {
    const hourglass = "./assets/clessidra.webp";

    root.innerHTML = `
      <h2 class="h2">Partita in corso</h2>

      <div class="role-illustration">
        <img src="${hourglass}" alt="Clessidra" loading="eager" decoding="async">
      </div>

      <div class="step">
        <div class="big">Tempo rimanente</div>
        <div class="reveal" style="font-size:22px;" id="timerValue">${formatMMSS(app.remainingSec)}</div>
      </div>

      <div class="btnbar">
        <button class="btn primary" id="endTurn">Termina turno</button>
        <button class="btn soft" id="goHome">Home</button>
      </div>
    `;

    $("#endTurn").addEventListener("click", () => { stopTimer(); app.view = STATE.END_TURN; render(); });
    $("#goHome").addEventListener("click", () => { stopTimer(); resetRound(); app.view = STATE.RULES; render(); });
    return;
  }

  if (app.view === STATE.END_TURN) {
    root.innerHTML = `
      <h2 class="h2">Fine turno</h2>
      <div class="step">
        <div class="big">Smascherate l’impostore</div>
        <p class="p" style="text-align:center;">Discutete e votate, poi visualizzate il risultato.</p>
      </div>

      <div class="btnbar">
        <button class="btn primary" id="showResult">Visualizza risultato</button>
        <button class="btn soft" id="goHome">Home</button>
      </div>
    `;
    $("#showResult").addEventListener("click", () => { app.view = STATE.RESULT; render(); });
    $("#goHome").addEventListener("click", () => { resetRound(); app.view = STATE.RULES; render(); });
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
    `;

    $("#newRound").addEventListener("click", () => { resetRound(); app.view = STATE.DISTRIBUTION; render(); });
    $("#goHome").addEventListener("click", () => { resetRound(); app.view = STATE.RULES; render(); });
    return;
  }
}

// ---------- init ----------
(async function init() {
  const musicBtn = document.querySelector("#musicToggle");
    if (musicBtn) {
      musicBtn.addEventListener("click", async () => {
        await setBgmEnabled(!bgmEnabled);
      });
    }

// imposta icona iniziale coerente
const musicIcon = document.querySelector("#musicIcon");
if (musicIcon) musicIcon.textContent = bgmEnabled ? "🔈" : "🔇";
  applyTheme(localStorage.getItem("impostore_theme") || "light");
  $("#themeToggle").addEventListener("click", toggleTheme);

  try { await loadWords(); }
  catch (e) {
    $("#cardContent").innerHTML = `<h2 class="h2">Errore</h2><div class="reveal" style="font-size:14px;text-align:left;">${String(e.message || e)}</div>`;
    return;
  }

  render();
})();
