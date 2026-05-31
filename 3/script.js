// discord: anubisgpt, roblox: iPxchy_Vibxs

const quoteBox = document.getElementById("quoteBox");
const typingInput = document.getElementById("typingInput");

// all the stat display elements grabbed once at the top
const timeLeftText = document.getElementById("timeLeft");
const wpmText = document.getElementById("wpm");
const accuracyText = document.getElementById("accuracy");
const bestWpmText = document.getElementById("bestWpm");
const mistakesText = document.getElementById("mistakes");
const typedCharsText = document.getElementById("typedChars");
const statusText = document.getElementById("statusText");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

// the pool of prompts the test pulls from randomly each round
const lines = [
  "small steps every day usually beat big plans that never leave the desk.",
  "a quiet room, a clear head, and a working keyboard can fix a lot of things.",
  "most simple tools stay useful because they do one job and do not get in the way.",
  "speed matters less when the work is clean, repeatable, and easy to maintain later.",
  "good practice comes from doing the same thing enough times that the rough parts start to show."
];

// mutable round state, everything else above stays constant
// keeping this in one object means reset is just overwriting fields instead of hunting variables
const app = {
  currentText: "",  // the active prompt the user is typing against
  started: false,   // true once the timer is running
  done: false,      // true once time runs out or user finishes the prompt
  secondsLeft: 60,
  totalTyped: 0,    // raw character count, includes mistakes
  wrongCount: 0,    // mismatched characters at current input position
  timerId: null,    // holds the setInterval reference so it can be cleared
  startedAt: 0,
  bestWpm: loadBest() // pulled from localStorage on load
};

bestWpmText.textContent = app.bestWpm;

// input is locked until the user presses start, prevents typing before the timer runs
typingInput.disabled = true;

pickText();
refreshNumbers();

startBtn.addEventListener("click", startTest);
restartBtn.addEventListener("click", resetTest);

// every keystroke goes through onTyping which drives most of the round logic
typingInput.addEventListener("input", onTyping);

// localStorage gives us persistence without a backend
// the guard against NaN handles cases where the stored value got corrupted somehow
function loadBest() {
  const saved = localStorage.getItem("typing-best-wpm");
  const num = Number(saved);
  return Number.isNaN(num) || !saved ? 0 : num;
}

function saveBest(value) {
  localStorage.setItem("typing-best-wpm", String(value));
}

// picks a random line and redraws the quote box with no typed input yet
function pickText() {
  const next = lines[Math.floor(Math.random() * lines.length)];
  app.currentText = next;
  drawQuote(""); // empty string so nothing is marked correct or wrong yet
}

function startTest() {
  // if a round is already running just push focus back to the input
  if (app.started && !app.done) {
    typingInput.focus();
    return;
  }

  // if coming from a finished round, clean up before starting fresh
  if (app.done) {
    resetTest();
  }

  app.started = true;
  app.done = false;
  app.startedAt = Date.now();
  statusText.textContent = "running";
  typingInput.disabled = false;
  typingInput.focus();

  // kill old timer so two intervals can't stack if start is clicked repeatedly
  if (app.timerId) {
    clearInterval(app.timerId);
  }

  // counts down every second, the interval is what drives the time display
  // when it hits zero it hands off to finishTest which handles cleanup
  app.timerId = setInterval(() => {
    app.secondsLeft -= 1;
    timeLeftText.textContent = app.secondsLeft;

    if (app.secondsLeft <= 0) {
      finishTest();
    }
  }, 1000);
}

// brings everything back to the initial state so a new round can begin cleanly
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

  // pick a fresh prompt so the user isn't repeating the same line
  pickText();
  refreshNumbers();
}

// fires on every keystroke while the input is active
// this is the core of the round, it compares typed input against the target and updates everything
function onTyping() {
  if (!app.started || app.done) {
    return;
  }

  const typed = typingInput.value;
  const target = app.currentText;

  // totalTyped is the raw length, not just correct chars
  app.totalTyped = typed.length;

  let wrong = 0;

  // walk through each typed character and compare it against the same position in the target
  // this means inserting an early wrong character shifts all subsequent ones wrong too
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== target[i]) {
      wrong += 1;
    }
  }

  app.wrongCount = wrong;

  // redraw the colored quote and recalculate stats on every input event
  drawQuote(typed);
  refreshNumbers();

  // finishing the prompt early ends the round without waiting for the timer
  if (typed === target) {
    finishTest();
  }
}

// rebuilds the quote box as a series of spans so each character can be colored individually
// this runs on every keystroke so the visual feedback stays in sync with the input
function drawQuote(typed) {
  let html = "";

  for (let i = 0; i < app.currentText.length; i++) {
    const real = app.currentText[i];
    const got = typed[i];

    if (got == null) {
      // this character hasn't been reached yet
      // the "now" class marks the next expected character as a soft cursor indicator
      if (i === typed.length && !app.done) {
        html += '<span class="now">' + escapeHtml(real) + "</span>";
      } else {
        html += "<span>" + escapeHtml(real) + "</span>";
      }
      continue;
    }

    // correct gets green, wrong gets red, decided per character
    if (got === real) {
      html += '<span class="ok">' + escapeHtml(real) + "</span>";
    } else {
      html += '<span class="bad">' + escapeHtml(real) + "</span>";
    }
  }

  quoteBox.innerHTML = html;
}

// recalculates and pushes all stat values to the DOM
// called after every keystroke and after reset so the display never goes stale
function refreshNumbers() {
  typedCharsText.textContent = app.totalTyped;
  mistakesText.textContent = app.wrongCount;

  // goodChars is the portion of typed input that actually matched the target
  const goodChars = Math.max(0, app.totalTyped - app.wrongCount);

  // minutesUsed grows as the timer counts down, used as the denominator in WPM
  const minutesUsed = (60 - app.secondsLeft) / 60;
  let wpm = 0;

  // standard WPM convention treats every 5 characters as one word
  // guarding against zero prevents a divide-by-zero on the first frame
  if (minutesUsed > 0) {
    wpm = Math.round(goodChars / 5 / minutesUsed);
  }

  let accuracy = 100;

  // accuracy is only meaningful once the user has actually typed something
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

// called either when time hits zero or when the user finishes the prompt early
// the done guard at the top prevents this running twice if both happen close together
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

  // read the already-calculated WPM from the DOM rather than recalculating
  const finalWpm = Number(wpmText.textContent);

  // only update best if this round actually beat the previous record
  if (finalWpm > app.bestWpm) {
    app.bestWpm = finalWpm;
    saveBest(finalWpm);
    bestWpmText.textContent = app.bestWpm;
  }
}

// any character that has meaning in HTML needs to be escaped before going into innerHTML
// without this, a quote prompt containing < or & would break the span structure entirely
function escapeHtml(value) {
  if (value === "&") return "&amp;";
  if (value === "<") return "&lt;";
  if (value === ">") return "&gt;";
  if (value === '"') return "&quot;";
  return value;
}
