// -----------------------------
// Stato + utility
// -----------------------------
const $ = (sel) => document.querySelector(sel);

const STATE = {
  RULES: "rules",
  SETTINGS: "settings",
  DISTRIBUTION: "distribution",
  PLAYING: "playing",
  END_TURN: "end_turn",
};

const WORDS = [
  "Pizzeria", "Aeroporto", "Spiaggia", "Biblioteca", "Ospedale",
  "Stazione", "Museo", "Palestra", "Castello", "Supermercato",
  "Cinema", "Scuola", "Ristorante", "Teatro", "Parco"
];

const app = {
  view: STATE.RULES,
  players: 6,          // 3..20
  minutes: 3,          // 1..60
  currentPlayer: 1,
  impostorIndex: 1,
  secretWord: "",
  revealed: false,
  timerId: null,
  remainingSec: 0,
};

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function pad2(n){ return String(n).padStart(2, "0"); }

function formatMMSS(totalSec){
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function pickRandom(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function resetRound(){
  app.currentPlayer = 1;
  app.impostorIndex = Math.floor(Math.random() * app.players) + 1;
  app.secretWord = pickRandom(WORDS);
  app.revealed = false;
  stopTimer();
}

function startTimer(){
  stopTimer();
  app.remainingSec = app.minutes * 60;

  app.timerId = setInterval(() => {
    app.remainingSec = Math.max(0, app.remainingSec - 1);
    // Aggiorna solo la parte di timer, se presente
    const t = $("#timerValue");
    if (t) t.textContent = formatMMSS(app.remainingSec);

    if (app.remainingSec === 0) {
      stopTimer();
      app.view = STATE.END_TURN;
      render();
    }
  }, 1000);
}

function stopTimer(){
  if (app.timerId){
    clearInterval(app.timerId);
    app.timerId = null;
  }
}

// -----------------------------
// Tema chiaro/scuro
// -----------------------------
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  $("#themeIcon").textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("impostore_theme", theme);
}

function toggleTheme(){
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

// -----------------------------
// Render UI
// -----------------------------
function render(){
  const root = $("#cardContent");
  if (!root) return;

  if (app.view === STATE.RULES) {
    root.innerHTML = `
      <h2 class="h2">Regole</h2>
      <p class="p">
        Ogni giocatore riceve una parola segreta, tranne uno: <strong>l’impostore</strong>.
        L’impostore sa solo di essere impostore e deve bluffare. Gli altri devono scoprirlo.
      </p>
      <p class="p">
        Dopo la distribuzione dei ruoli, parte un conto alla rovescia. Quando finisce (o quando lo decidi),
        si vota per smascherare l’impostore e si avvia un nuovo turno.
      </p>
      <div class="btnbar">
        <button class="btn primary" id="goSettings">Vai alle impostazioni</button>
      </div>
      <div class="note">Suggerimento: passate il telefono senza far vedere lo schermo agli altri.</div>
    `;

    $("#goSettings").addEventListener("click", () => {
      app.view = STATE.SETTINGS;
      render();
    });
    return;
  }

  if (app.view === STATE.SETTINGS) {
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
        <button class="btn primary" id="startDistribution">Avvia distribuzione ruoli</button>
        <button class="btn soft" id="backRules">Torna alle regole</button>
      </div>
    `;

    $("#playersMinus").addEventListener("click", () => {
      app.players = clamp(app.players - 1, 3, 20);
      render();
    });
    $("#playersPlus").addEventListener("click", () => {
      app.players = clamp(app.players + 1, 3, 20);
      render();
    });
    $("#timeMinus").addEventListener("click", () => {
      app.minutes = clamp(app.minutes - 1, 1, 60);
      render();
    });
    $("#timePlus").addEventListener("click", () => {
      app.minutes = clamp(app.minutes + 1, 1, 60);
      render();
    });

    $("#startDistribution").addEventListener("click", () => {
      resetRound();
      app.view = STATE.DISTRIBUTION;
      render();
    });

    $("#backRules").addEventListener("click", () => {
      app.view = STATE.RULES;
      render();
    });
    return;
  }

  if (app.view === STATE.DISTRIBUTION) {
    const isLastPlayer = app.currentPlayer === app.players;

    root.innerHTML = `
      <h2 class="h2">Distribuzione ruoli</h2>

      <div class="step">
        <div class="big">Visualizza ruolo del giocatore ${app.currentPlayer}</div>
        ${app.revealed ? `
          <div class="reveal" id="revealBox">
            ${app.currentPlayer === app.impostorIndex ? "Sei l’impostore" : `Parola: ${app.secretWord}`}
          </div>
        ` : `
          <p class="p" style="text-align:center;">
            Premi il pulsante per vedere la parola (o il ruolo impostore).
          </p>
        `}
      </div>

      <div class="btnbar">
        ${!app.revealed ? `
          <button class="btn primary" id="showRole">Mostra parola</button>
          <button class="btn soft" id="abortToSettings">Annulla</button>
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
      $("#abortToSettings").addEventListener("click", () => {
        resetRound();
        app.view = STATE.SETTINGS;
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
        <button class="btn soft" id="stopToSettings">Impostazioni</button>
      </div>

      <div class="note">Consiglio: fate un giro di descrizioni brevi della parola, poi votate.</div>
    `;

    $("#endTurn").addEventListener("click", () => {
      stopTimer();
      app.view = STATE.END_TURN;
      render();
    });

    $("#stopToSettings").addEventListener("click", () => {
      stopTimer();
      app.view = STATE.SETTINGS;
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
          Discutete e votate. Poi avviate un nuovo turno.
        </p>
      </div>

      <div class="btnbar">
        <button class="btn primary" id="newRound">Avvia un nuovo turno</button>
        <button class="btn soft" id="backSettings">Impostazioni</button>
      </div>

      <div class="note">Il nuovo turno riassegna impostore e parola usando le impostazioni correnti.</div>
    `;

    $("#newRound").addEventListener("click", () => {
      resetRound();
      app.view = STATE.DISTRIBUTION;
      render();
    });

    $("#backSettings").addEventListener("click", () => {
      resetRound();
      app.view = STATE.SETTINGS;
      render();
    });
    return;
  }
}

// -----------------------------
// Init
// -----------------------------
(function init(){
  // Tema da storage
  const savedTheme = localStorage.getItem("impostore_theme") || "light";
  applyTheme(savedTheme);

  $("#themeToggle").addEventListener("click", toggleTheme);

  // Stato iniziale
  app.view = STATE.RULES;
  render();
})();
