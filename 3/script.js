// discord: anubisgpt, roblox: iPxchy_Vibxs

const quoteBox = document.getElementById("quoteBox");
const typingInput = document.getElementById("typingInput");

const timeLeftText = document.getElementById("timeLeft");
const wpmText = document.getElementById("wpm");
const accuracyText = document.getElementById("accuracy");
const bestWpmText = document.getElementById("bestWpm");
const mistakesText = document.getElementById("mistakes");
const typedCharsText = document.getElementById("typedChars");
const statusText = document.getElementById("statusText");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

// short prompt list for the round
const lines = [
  "small steps every day usually beat big plans that never leave the desk.",
  "a quiet room, a clear head, and a working keyboard can fix a lot of things.",
  "most simple tools stay useful because they do one job and do not get in the way.",
  "speed matters less when the work is clean, repeatable, and easy to maintain later.",
  "good practice comes from doing the same thing enough times that the rough parts start to show."
];

// keep only the values that change during a round
const app = {
  currentText: "",
  started: false,
  done: false,
  secondsLeft: 60,
  totalTyped: 0,
  wrongCount: 0,
  timerId: null,
  startedAt: 0,
  bestWpm: loadBest()
};

bestWpmText.textContent = app.bestWpm;
typingInput.disabled = true;

// setup
pickText();
refreshNumbers();

startBtn.addEventListener("click", startTest);
restartBtn.addEventListener("click", resetTest);
typingInput.addEventListener("input", onTyping);

// read saved best score once when the page loads
function loadBest() {
  const saved = localStorage.getItem("typing-best-wpm");
  const num = Number(saved);
  return Number.isNaN(num) || !saved ? 0 : num;
}

function saveBest(value) {
  localStorage.setItem("typing-best-wpm", String(value));
}

// pick the next line, then redraw the visible quote
function pickText() {
  const next = lines[Math.floor(Math.random() * lines.length)];
  app.currentText = next;
  drawQuote("");
}

// start the timer and unlock the input
function startTest() {
  if (app.started && !app.done) {
    typingInput.focus();
    return;
  }

  if (app.done) {
    resetTest();
  }

  app.started = true;
  app.done = false;
  app.startedAt = Date.now();
  statusText.textContent = "running";
  typingInput.disabled = false;
  typingInput.focus();

  // clear old timer first so only one round is active
  if (app.timerId) {
    clearInterval(app.timerId);
  }

  app.timerId = setInterval(() => {
    app.secondsLeft -= 1;
    timeLeftText.textContent = app.secondsLeft;

    if (app.secondsLeft <= 0) {
      finishTest();
    }
  }, 1000);
}

// func to bring everything back to the first state
function resetTest() {
  if (app.timerId) {
    clearInterval(app.timerId);
    app.timerId = null;
  }

  app.started = false;
  app.done = false;
  app.secondsLeft = 60;
  app.totalTyped = 0;
  app.wrongCount = 0;

  typingInput.value = "";
  typingInput.disabled = true;

  timeLeftText.textContent = "60";
  statusText.textContent = "ready";

  pickText();
  refreshNumbers();
}

// compare current input against the active line
function onTyping() {
  if (!app.started || app.done) {
    return;
  }

  const typed = typingInput.value;
  const target = app.currentText;

  app.totalTyped = typed.length;

  let wrong = 0;

  // count mismatches by position
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== target[i]) {
      wrong += 1;
    }
  }

  // if user deleted some characters, then count those as wrong too
  app.wrongCount = wrong;
  drawQuote(typed);
  refreshNumbers();

  if (typed === target) {
    finishTest();
  }
}

// rebuild the prompt so each character can show its current state
function drawQuote(typed) {
  let html = "";

  for (let i = 0; i < app.currentText.length; i++) {
    const real = app.currentText[i];
    const got = typed[i];

    if (got == null) {
      // mark the next position while the round is still active
      if (i === typed.length && !app.done) {
        html += '<span class="now">' + escapeHtml(real) + "</span>";
      } else {
        html += "<span>" + escapeHtml(real) + "</span>";
      }
      continue;
    }

    if (got === real) {
      html += '<span class="ok">' + escapeHtml(real) + "</span>";
    } else {
      html += '<span class="bad">' + escapeHtml(real) + "</span>";
    }
  }

  quoteBox.innerHTML = html;
}

// update values shown under the round
function refreshNumbers() {
  typedCharsText.textContent = app.totalTyped;
  mistakesText.textContent = app.wrongCount;

  // calculate WPM and accuracy based on current input
  const goodChars = Math.max(0, app.totalTyped - app.wrongCount);
  const minutesUsed = (60 - app.secondsLeft) / 60;
  let wpm = 0;

  // standard typing calc: 5 chars = 1 word
  if (minutesUsed > 0) {
    wpm = Math.round(goodChars / 5 / minutesUsed);
  }

  let accuracy = 100;

  // if user typed, check how many were correct
  if (app.totalTyped > 0) {
    accuracy = Math.max(
      0,
      Math.round((goodChars / app.totalTyped) * 100)
    );
  }

  wpmText.textContent = wpm;
  accuracyText.textContent = accuracy;
  bestWpmText.textContent = app.bestWpm;
}

// stop the round and save a new best if needed
function finishTest() {
  if (app.done) {
    return;
  }

  app.done = true;
  app.started = false;
  statusText.textContent = "done";
  typingInput.disabled = true;

  if (app.timerId) {
    clearInterval(app.timerId);
    app.timerId = null;
  }

  const finalWpm = Number(wpmText.textContent);

  if (finalWpm > app.bestWpm) {
    app.bestWpm = finalWpm;
    saveBest(finalWpm);
    bestWpmText.textContent = app.bestWpm;
  }
}

// keep the rendered quote safe before using innerHTML
function escapeHtml(value) {
  if (value === "&") return "&amp;";
  if (value === "<") return "&lt;";
  if (value === ">") return "&gt;";
  if (value === '"') return "&quot;";
  return value;
}
