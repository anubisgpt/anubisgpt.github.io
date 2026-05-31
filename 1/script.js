// discord: anubisgpt, roblox: iPxchy_Vibxs

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// grab all the HUD elements once so we're not querying the DOM every frame
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("best");
const restartBtn = document.getElementById("restartBtn");

// tracks which keys are currently held down
const keys = {};

// centralized state so reset is just overwriting values
const state = {
  running: true,
  score: 0,
  lives: 3,
  bestScore: Number(localStorage.getItem("shooter-best") || 0), // keep best score between sessions
  lastTime: 0,
  enemyTimer: 0,
  enemyInterval: 900, // ms between spawns, decreases over time
  bulletCooldown: 0,
  player: {
    x: canvas.width / 2 - 18, // centered horizontally
    y: canvas.height - 60, // near the bottom
    width: 36,
    height: 24,
    speed: 320 // px per second
  },
  bullets: [],
  enemies: []
};

bestEl.textContent = state.bestScore;

// using lowercase so "ArrowLeft" and "arrowleft" don't create separate entries
window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;

  // stop page scroll when pressing space
  if (event.key === " ") {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

restartBtn.addEventListener("click", resetGame);

// reset the round without reloading the page, just slam defaults back in
function resetGame() {
  state.running = true;
  state.score = 0;
  state.lives = 3;
  state.lastTime = 0;
  state.enemyTimer = 0;
  state.enemyInterval = 900;
  state.bulletCooldown = 0;

  // re-center the player
  state.player.x = canvas.width / 2 - 18;
  state.player.y = canvas.height - 60;

  // wipe all projectiles and enemies from last round
  state.bullets = [];
  state.enemies = [];

  updateHud();
  requestAnimationFrame(gameLoop);
}

// push current values into the DOM
function updateHud() {
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  bestEl.textContent = state.bestScore;
}

// bullet spawns from the center top of the player
function shootBullet() {
  state.bullets.push({
    x: state.player.x + state.player.width / 2 - 3, // center it on the ship
    y: state.player.y - 10, // just above the player sprite
    width: 6,
    height: 12,
    speed: 460,
    active: true // flipped to false on hit or offscreen, cleaned up later
  });
}

// enemy stats aren't fixed every spawn, gives variety
function spawnEnemy() {
  // random size between 26 and 44
  const size = 26 + Math.random() * 18;

  state.enemies.push({
    x: Math.random() * (canvas.width - size), // keep fully inside canvas horizontally
    y: -size, // start above canvas so it slides in
    width: size,
    height: size,
    speed: 110 + Math.random() * 90, // slight speed variation per enemy
    active: true
  });
}

// basic AABB collision, works for all rectangle entities
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// dt is in seconds, all speeds are px/s
function updatePlayer(dt) {
  // support both arrow keys and WASD
  const moveLeft = keys["arrowleft"] || keys["a"];
  const moveRight = keys["arrowright"] || keys["d"];
  const wantsToShoot = keys[" "];

  if (moveLeft) {
    state.player.x -= state.player.speed * dt;
  }

  if (moveRight) {
    state.player.x += state.player.speed * dt;
  }

  // clamp inside play area, left edge
  if (state.player.x < 0) state.player.x = 0;

  // clamp right edge
  if (state.player.x + state.player.width > canvas.width) {
    state.player.x = canvas.width - state.player.width;
  }

  // countdown to next shot
  if (state.bulletCooldown > 0) {
    state.bulletCooldown -= dt;
  }

  // hold space to keep firing, cooldown prevents bullet spam
  if (wantsToShoot && state.bulletCooldown <= 0) {
    shootBullet();
    state.bulletCooldown = 0.22; // roughly 4-5 shots per second
  }
}

// movement and despawn only, collisions handled separately
function updateBullets(dt) {
  for (const bullet of state.bullets) {
    // bullets travel upward
    bullet.y -= bullet.speed * dt;

    // off the top of the screen, no longer needed
    if (bullet.y + bullet.height < 0) {
      bullet.active = false; // removed later in cleanup
    }
  }
}

function updateEnemies(dt) {
  // accumulate time since last spawn
  state.enemyTimer += dt * 1000;

  // spawn a new enemy once the interval is hit
  if (state.enemyTimer >= state.enemyInterval) {
    spawnEnemy();
    state.enemyTimer = 0;

    // cap difficulty growth so it doesn't become literally impossible
    if (state.enemyInterval > 380) {
      state.enemyInterval -= 10;
    }
  }

  for (const enemy of state.enemies) {
    // enemies fall downward
    enemy.y += enemy.speed * dt;

    // enemy got through without being shot, costs a life
    if (enemy.y > canvas.height) {
      enemy.active = false;
      state.lives -= 1;
      updateHud();

      // check if that was the last life
      if (state.lives <= 0) {
        endGame();
      }
    }
  }
}

// resolve bullet-enemy hits first, then enemy-player contact
function checkCollisions() {
  // bullet vs enemy
  for (const bullet of state.bullets) {
    if (!bullet.active) continue;

    for (const enemy of state.enemies) {
      if (!enemy.active) continue;

      if (isColliding(bullet, enemy)) {
        bullet.active = false; // cleanup handles actual removal from array
        enemy.active = false;
        state.score += 10;

        // update best if beaten
        if (state.score > state.bestScore) {
          state.bestScore = state.score;
          localStorage.setItem("shooter-best", String(state.bestScore)); // save new high score
        }

        updateHud();
        break; // one bullet can only hit one enemy
      }
    }
  }

  // enemy vs player, direct contact
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;

    if (isColliding(enemy, state.player)) {
      enemy.active = false; // enemy is consumed on hit
      state.lives -= 1;
      updateHud();

      if (state.lives <= 0) {
        endGame();
      }
    }
  }
}

// remove inactive objects in one place so update loops stay clean
// doing it separately avoids modifying arrays while iterating them
function cleanupObjects() {
  state.bullets = state.bullets.filter((bullet) => bullet.active);
  state.enemies = state.enemies.filter((enemy) => enemy.active);
}

// just flip the flag, the loop handles the rest
function endGame() {
  state.running = false;
}

function drawBackground() {
  // solid dark background
  ctx.fillStyle = "#0f1720";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";

  // fake stars, same positions every frame so they don't flicker
  // using modulo with primes to scatter them without storing positions
  for (let i = 0; i < 45; i++) {
    const x = (i * 173) % canvas.width;
    const y = (i * 97) % canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawPlayer() {
  // main body
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(
    state.player.x,
    state.player.y,
    state.player.width,
    state.player.height
  );

  // cockpit on top, slightly darker
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(
    state.player.x + 12,
    state.player.y - 8,
    12,
    10
  );
}

function drawBullets() {
  ctx.fillStyle = "#f8fafc"; // near white so they stand out

  for (const bullet of state.bullets) {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
}

// enemies are just red rectangles for now
function drawEnemies() {
  ctx.fillStyle = "#ef4444";

  for (const enemy of state.enemies) {
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  }
}

// only renders when the game is over
function drawOverlay() {
  if (state.running) return;

  // dim the background so text is readable
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  // big title
  ctx.font = "28px Arial";
  ctx.fillText("game over", canvas.width / 2, canvas.height / 2 - 10);

  // score and instructions below
  ctx.font = "16px Arial";
  ctx.fillText(
    "score: " + state.score + "  |  press restart to play again",
    canvas.width / 2,
    canvas.height / 2 + 24
  );
}

// draw everything in order, background first so it's behind everything
function draw() {
  drawBackground();
  drawPlayer();
  drawBullets();
  drawEnemies();
  drawOverlay();
}

// main loop: update state then render
function gameLoop(timestamp) {
  // still draw the final frame after game over so overlay shows
  if (!state.running && state.lastTime !== 0) {
    draw();
    return;
  }

  // first frame, no delta yet so just store the timestamp
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  // requestAnimationFrame gives ms, convert to seconds for all the speed math
  const dt = (timestamp - state.lastTime) / 1000;
  state.lastTime = timestamp;

  // order matters: move stuff, then check hits, then remove dead objects
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  checkCollisions();
  cleanupObjects();
  draw();

  // keep looping until game ends
  if (state.running) {
    requestAnimationFrame(gameLoop);
  }
}

// show initial HUD values before anything starts
updateHud();
requestAnimationFrame(gameLoop);
