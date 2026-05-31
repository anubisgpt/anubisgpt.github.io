// discord: anubisgpt, roblox: iPxchy_Vibxs

const stage = document.getElementById("stage");
const message = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const bestScoreText = document.getElementById("bestScore");
const lastScoreText = document.getElementById("lastScore");
const historyList = document.getElementById("historyList");

// keep round state here so click handling stays simple
const app = {
  mode: "idle", // idle | waiting | ready | done | too-soon
  waitTimer: null,
  readyAt: 0,
  lastTime: null,
  bestTime: readBest(), // persisted in localStorage
  tries: [] // newest first
};

// setup
paintStats();
drawHistory();

// evnt handlers
startBtn.addEventListener("click", beginRound);
resetBtn.addEventListener("click", clearScores);
stage.addEventListener("click", handleStageClick);

// load saved best time once on page open
function readBest() {
  const saved = localStorage.getItem("reaction-best-ms");
  if (!saved) return null;

  // guard against corrupted or non-numeric storage values
  const value = Number(saved);
  return Number.isNaN(value) ? null : value;
}

function saveBest(value) {
  localStorage.setItem("reaction-best-ms", String(value));
}

// move from idle/done into the waiting state
function beginRound() {
  // don't interrupt a round that's already running
  if (app.mode === "waiting" || app.mode === "ready") {
    return;
  }

  if (app.waitTimer) {
    clearTimeout(app.waitTimer);
    app.waitTimer = null;
  }

  app.mode = "waiting";
  app.readyAt = 0;
  setStageClass("waiting");
  message.textContent = "wait for it";

  // random delay so the user can't just predict the timing
  const delay = 1400 + Math.floor(Math.random() * 2600);

  // after the delay, switch to the clickable state
  app.waitTimer = setTimeout(() => {
    app.mode = "ready";
    app.readyAt = performance.now(); // sub-ms precision matters for reaction timing
    setStageClass("ready");
    message.textContent = "click now";
    app.waitTimer = null;
  }, delay);
}

// the stage click does different things depending on the current mode
function handleStageClick() {
  if (app.mode === "idle") {
    return;
  }

  // clicked before the signal showed up
  if (app.mode === "waiting") {
    missStart();
    return;
  }

  if (app.mode === "ready") {
    finishRound();
    return;
  }

  // after a finished round or early click, tapping stage starts a new one
  if (app.mode === "done" || app.mode === "too-soon") {
    beginRound();
  }
}

// early click ends the current round before the signal appears
function missStart() {
  // kill the pending timer so the ready state never fires
  if (app.waitTimer) {
    clearTimeout(app.waitTimer);
    app.waitTimer = null;
  }

  app.mode = "too-soon";
  app.readyAt = 0;
  setStageClass("too-soon");
  message.textContent = "too early. click or press start to try again";
}

// record the reaction time, then update score and history
function finishRound() {
  const now = performance.now();
  const time = Math.round(now - app.readyAt);

  app.lastTime = time;
  app.tries.unshift(time);

  // keep only the newest few results so the list doesn't grow forever
  if (app.tries.length > 6) {
    app.tries.pop();
  }

  // check if this beats the stored record
  if (app.bestTime === null || time < app.bestTime) {
    app.bestTime = time;
    saveBest(time);
  }

  app.mode = "done";
  setStageClass("done");
  message.textContent = time + " ms. click here to go again";

  paintStats();
  drawHistory();
}

// clear both the visible values and the saved best time
function clearScores() {
  // stop any in-progress round
  if (app.waitTimer) {
    clearTimeout(app.waitTimer);
    app.waitTimer = null;
  }

  app.mode = "idle";
  app.readyAt = 0;
  app.lastTime = null;
  app.bestTime = null;
  app.tries = [];

  localStorage.removeItem("reaction-best-ms");

  setStageClass("idle");
  message.textContent = "press start, then wait for the signal";

  paintStats();
  drawHistory();
}

// show best and latest result in the top area
function paintStats() {
  bestScoreText.textContent = app.bestTime === null ? "-" : app.bestTime + " ms";
  lastScoreText.textContent = app.lastTime === null ? "-" : app.lastTime + " ms";
}

// rebuild the recent results list from current app state
function drawHistory() {
  historyList.innerHTML = "";

  if (app.tries.length === 0) {
    const item = document.createElement("li");
    item.textContent = "no tries yet";
    historyList.appendChild(item);
    return;
  }

  // show each recent attempt in the list
  for (let i = 0; i < app.tries.length; i++) {
    const item = document.createElement("li");
    item.textContent = "attempt " + (i + 1) + ": " + app.tries[i] + " ms";
    historyList.appendChild(item);
  }
}

// switch stage appearance by replacing the current mode class
function setStageClass(name) {
  stage.className = "stage " + name;
}
