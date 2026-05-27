const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("best");
const restartBtn = document.getElementById("restartBtn");

const keys = {};

// keep the main round values here so reset stays simple
const state = {
  running: true,
  score: 0,
  lives: 3,
  bestScore: Number(localStorage.getItem("shooter-best") || 0),
  lastTime: 0,
  enemyTimer: 0,
  enemyInterval: 900,
  bulletCooldown: 0,
  player: {
    x: canvas.width / 2 - 18,
    y: canvas.height - 60,
    width: 36,
    height: 24,
    speed: 320
  },
  bullets: [],
  enemies: []
};

bestEl.textContent = state.bestScore;

// keep key state between frames for smoother movement
window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;

  if (event.key === " ") {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

restartBtn.addEventListener("click", resetGame);

// reset the round without reloading the page
function resetGame() {
  state.running = true;
  state.score = 0;
  state.lives = 3;
  state.lastTime = 0;
  state.enemyTimer = 0;
  state.enemyInterval = 900;
  state.bulletCooldown = 0;
  state.player.x = canvas.width / 2 - 18;
  state.player.y = canvas.height - 60;
  state.bullets = [];
  state.enemies = [];
  updateHud();
  requestAnimationFrame(gameLoop);
}

function updateHud() {
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  bestEl.textContent = state.bestScore;
}

// add a new bullet coming from the player
function shootBullet() {
  state.bullets.push({
    x: state.player.x + state.player.width / 2 - 3,
    y: state.player.y - 10,
    width: 6,
    height: 12,
    speed: 460,
    active: true
  });
}

function spawnEnemy() {
  const size = 26 + Math.random() * 18;

  state.enemies.push({
    x: Math.random() * (canvas.width - size),
    y: -size,
    width: size,
    height: size,
    speed: 110 + Math.random() * 90,
    active: true
  });
}

// basic box collision for bullets, enemies, and player
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// read input, move player, and handle fire cooldown
function updatePlayer(dt) {
  const moveLeft = keys["arrowleft"] || keys["a"];
  const moveRight = keys["arrowright"] || keys["d"];
  const wantsToShoot = keys[" "];

  if (moveLeft) {
    state.player.x -= state.player.speed * dt;
  }

  if (moveRight) {
    state.player.x += state.player.speed * dt;
  }

  // keep player within bounds of the canvas (so no offscreen)
  if (state.player.x < 0) state.player.x = 0;
  if (state.player.x + state.player.width > canvas.width) {
    state.player.x = canvas.width - state.player.width;
  }

  if (state.bulletCooldown > 0) {
    state.bulletCooldown -= dt;
  }

  // block rapid fire by waiting a short time between shots
  if (wantsToShoot && state.bulletCooldown <= 0) {
    shootBullet();
    state.bulletCooldown = 0.22;
  }
}

function updateBullets(dt) {
  for (const bullet of state.bullets) {
    bullet.y -= bullet.speed * dt;

    if (bullet.y + bullet.height < 0) {
      bullet.active = false;
    }
  }
}

// spawn enemies over time, then move active ones down the screen
function updateEnemies(dt) {
  state.enemyTimer += dt * 1000;

  if (state.enemyTimer >= state.enemyInterval) {
    spawnEnemy();
    state.enemyTimer = 0;

    // lower the gap slowly so the round gets harder
    if (state.enemyInterval > 380) {
      state.enemyInterval -= 10;
    }
  }

  // move down the enemy, & mark inactive if it goes off screen (and remove a life)
  for (const enemy of state.enemies) {
    enemy.y += enemy.speed * dt;

    if (enemy.y > canvas.height) {
      enemy.active = false;
      state.lives -= 1;
      updateHud();

      if (state.lives <= 0) {
        endGame();
      }
    }
  }
}

// resolve bullet hits first, then enemy contact with the player
function checkCollisions() {
  for (const bullet of state.bullets) {
    if (!bullet.active) continue;

    for (const enemy of state.enemies) {
      if (!enemy.active) continue;

      if (isColliding(bullet, enemy)) {
        bullet.active = false;
        enemy.active = false;
        state.score += 10;

        if (state.score > state.bestScore) {
          state.bestScore = state.score;
          localStorage.setItem("shooter-best", String(state.bestScore));
        }

        updateHud();
        break;
      }
    }
  }

  // if any enemy hits the player, mark it inactive and remove a life
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;

    if (isColliding(enemy, state.player)) {
      enemy.active = false;
      state.lives -= 1;
      updateHud();

      if (state.lives <= 0) {
        endGame();
      }
    }
  }
}

// remove objects that were marked inactive during updates
function cleanupObjects() {
  state.bullets = state.bullets.filter((bullet) => bullet.active);
  state.enemies = state.enemies.filter((enemy) => enemy.active);
}

function endGame() {
  state.running = false;
}

function drawBackground() {
  ctx.fillStyle = "#0f1720";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";

  // simple star pattern, same positions every frame
  for (let i = 0; i < 45; i++) {
    const x = (i * 173) % canvas.width;
    const y = (i * 97) % canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
}

// the player being as a rectangle with a smaller "cockpit" on top
function drawPlayer() {
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(
    state.player.x,
    state.player.y,
    state.player.width,
    state.player.height
  );

  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(
    state.player.x + 12,
    state.player.y - 8,
    12,
    10
  );
}

function drawBullets() {
  ctx.fillStyle = "#f8fafc";

  // draw all bullets as rectangles
  for (const bullet of state.bullets) {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
}

function drawEnemies() {
  ctx.fillStyle = "#ef4444";

  for (const enemy of state.enemies) {
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  }
}

// show a ""game over" overlay when the round ends
function drawOverlay() {
  if (state.running) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "28px Arial";
  ctx.fillText("game over", canvas.width / 2, canvas.height / 2 - 10);

  ctx.font = "16px Arial";
  ctx.fillText(
    "score: " + state.score + "  |  press restart to play again",
    canvas.width / 2,
    canvas.height / 2 + 24
  );
}

function draw() {
  drawBackground();
  drawPlayer();
  drawBullets();
  drawEnemies();
  drawOverlay();
}

// main loop: update game state first, then draw the current frame
function gameLoop(timestamp) {
  if (!state.running && state.lastTime !== 0) {
    draw();
    return;
  }

  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const dt = (timestamp - state.lastTime) / 1000;
  state.lastTime = timestamp;

  // update all info based on time since last frame
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  checkCollisions();
  cleanupObjects();
  draw();

  if (state.running) {
    requestAnimationFrame(gameLoop);
  }
}

updateHud();
requestAnimationFrame(gameLoop);