/**
 * Cockpit easter egg — click the jet icon next to "See the work" to fly
 * toward the Pillars of Creation. Once the scene settles it becomes a
 * small playable moment: a first-person asteroid shooter, entirely in
 * keeping with actually being in the cockpit — nothing external is
 * rendered (no ship sprite breaking the illusion of facing forward),
 * asteroids come straight down the barrel at the camera, and you aim a
 * reticle and fire to destroy them before they arrive.
 *
 * ---- The passive scene ----
 * The nebula photo and the canopy frame are static (CSS/SVG); this file
 * drives the starfield on <canvas>. Each star is tracked as an angle +
 * distance-from-center (depth stands in for "how far out/close it is"),
 * plus a small per-star angular drift so the field doesn't move in
 * perfectly rigid straight lines. Every star is drawn as a circle
 * sized/lit by its depth, with a trailing line added on top only when
 * it's moving fast enough for a streak to read — so the same system
 * produces both the hyperspace-jump burst on open and the calm drift it
 * settles into. Motion timeline: ~2.2s warp-in, ~1.6s ease down, then a
 * slow permanent cruise. Skips straight to cruise under
 * prefers-reduced-motion.
 *
 * ---- The game ----
 * Once cruise begins, a prompt invites the first input. Asteroids use
 * the same angle/distance model as the stars — spawned near the
 * vanishing point, growing as they approach — but on a deliberately
 * different, much more varied speed scale than the ambient stars (three
 * loose tiers: slow/medium/fast, chosen per-asteroid) so "some fast,
 * some slow" is baked into every spawn rather than being one narrow
 * random range. An asteroid that completes its approach unshot ends the
 * run immediately — waves change how many are in the air at once (a
 * repeating calm/intense spawn-rate cycle, plus a gentle long-run ramp),
 * not how hard any single one is to react to, so difficulty stays about
 * prioritizing targets rather than raw reflexes. Firing is a hit-scan
 * check against the reticle position — simpler and far more reliable
 * than simulating a traveling projectile, and it's what makes hits feel
 * earned instead of random. High score (asteroids destroyed) persists
 * in localStorage, phone-and-all, same as everything else here.
 */
(function () {
  var trigger = document.getElementById('cockpit-trigger');
  var overlay = document.getElementById('cockpit-overlay');
  var closeBtn = document.getElementById('cockpit-close');
  var canvas = document.getElementById('cockpit-canvas');
  var scene = overlay ? overlay.querySelector('.cockpit-scene') : null;
  var scoreEl = document.getElementById('cockpit-score');
  var promptEl = document.getElementById('cockpit-prompt');
  var gameoverEl = document.getElementById('cockpit-gameover');
  var gameoverScoreEl = document.getElementById('cockpit-gameover-score');
  if (!trigger || !overlay || !closeBtn || !canvas || !scene) return;

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var WARP_MS = 2200;
  var SETTLE_MS = 1600;
  var CRUISE_MULT = 0.11;
  var READY_DELAY_MS = reduceMotion ? 300 : (WARP_MS + SETTLE_MS);

  var HS_KEY = 'cockpit-asteroid-highscore';
  function getHighScore() {
    try { return parseFloat(localStorage.getItem(HS_KEY)) || 0; } catch (e) { return 0; }
  }
  function setHighScore(v) {
    try { localStorage.setItem(HS_KEY, String(v)); } catch (e) { /* private mode etc — fine to skip */ }
  }

  var stars = [];
  var asteroids = [];
  var explosions = [];
  var raf = null;
  var openedAt = 0;
  var lastT = 0;
  var w = 0, h = 0, maxRadius = 0;

  // 'intro' -> 'ready' -> 'playing' -> 'gameover'
  var state = 'intro';
  var gameTime = 0;
  var score = 0;

  var reticle = { x: 0, y: 0, targetX: 0, targetY: 0 };
  var RETICLE_BOUND_X = 0.42;
  var RETICLE_BOUND_Y = 0.36;
  var keys = { up: false, down: false, left: false, right: false };
  var pointerActive = false;
  var pointerId = null;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function sizeCanvas() {
    w = overlay.clientWidth;
    h = overlay.clientHeight;
    maxRadius = Math.hypot(w, h) / 2;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------------- starfield (unchanged passive layer) ---------------- */

  function resetStar(s, spawnNearCenter) {
    s.angle = Math.random() * Math.PI * 2;
    s.dist = spawnNearCenter ? Math.random() * 40 : Math.random() * maxRadius;
    s.speed = 70 + Math.random() * 110;
    s.angularVel = (Math.random() - 0.5) * 0.22;
    s.warm = Math.random() < 0.16;
    return s;
  }

  function initStars() {
    var count = Math.max(70, Math.min(240, Math.round((w * h) / 6000)));
    stars = [];
    for (var i = 0; i < count; i++) stars.push(resetStar({}, false));
  }

  function speedMultiplier(elapsedMs) {
    if (reduceMotion) return CRUISE_MULT;
    if (elapsedMs < WARP_MS) return 1;
    if (elapsedMs < WARP_MS + SETTLE_MS) {
      var t = (elapsedMs - WARP_MS) / SETTLE_MS;
      var eased = 1 - Math.pow(1 - t, 3);
      return 1 - eased * (1 - CRUISE_MULT);
    }
    return CRUISE_MULT;
  }

  function drawStars(cx, cy, dt, mult) {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var prevDist = s.dist;
      s.angle += s.angularVel * dt * (0.4 + mult);
      s.dist += s.speed * mult * dt * 5;
      if (s.dist > maxRadius) { resetStar(s, true); continue; }

      var cosA = Math.cos(s.angle), sinA = Math.sin(s.angle);
      var hx = cx + cosA * s.dist, hy = cy + sinA * s.dist;
      var depth = s.dist / maxRadius;
      var alpha = Math.min(1, depth / 0.28);
      var radius = 0.5 + depth * depth * 2.6;
      var color = s.warm ? '255, 199, 130' : '255, 255, 255';

      var streak = (s.dist - prevDist) * 2.2;
      if (streak > radius * 1.8) {
        var tx = cx + cosA * Math.max(0, s.dist - streak);
        var ty = cy + sinA * Math.max(0, s.dist - streak);
        ctx.strokeStyle = 'rgba(' + color + ', ' + alpha + ')';
        ctx.lineWidth = Math.max(0.8, radius * 0.85);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(' + color + ', ' + alpha + ')';
      ctx.beginPath();
      ctx.arc(hx, hy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------- asteroids ---------------- */

  function randRockShape() {
    var n = 7 + Math.floor(Math.random() * 3);
    var pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({ a: (i / n) * Math.PI * 2, r: 0.7 + Math.random() * 0.5 });
    }
    return pts;
  }

  // three loose speed tiers, picked per-asteroid — this is what actually
  // reads as "variation," not a single wide random() range
  function pickSpeed() {
    var r = Math.random();
    if (r < 0.4) return 12 + Math.random() * 8;   // slow — plenty of time to line up a shot
    if (r < 0.75) return 24 + Math.random() * 14; // medium
    return 42 + Math.random() * 20;               // fast — react now
  }

  function spawnAsteroid() {
    asteroids.push({
      angle: Math.random() * Math.PI * 2,
      dist: 10 + Math.random() * 20,
      speed: pickSpeed(),
      baseSize: 15 + Math.random() * 15,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.8,
      shape: randRockShape()
    });
  }

  function waveIntensity(t) {
    var cycle = 10;
    return (t % cycle) > 6 ? 1 : 0; // calm for 6s, an intense (denser) wave for the next 4s, repeat
  }

  function currentSpawnInterval(t) {
    var base = Math.max(0.55, 1.15 - t * 0.006); // gentle long-run ramp, capped so it never gets unfair
    return waveIntensity(t) ? base * 0.5 : base;
  }

  var spawnTimer = 0;

  function updateAsteroids(dt, cx, cy) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnAsteroid();
      spawnTimer = currentSpawnInterval(gameTime);
    }

    for (var i = asteroids.length - 1; i >= 0; i--) {
      var a = asteroids[i];
      a.dist += a.speed * dt * 5;
      a.rotation += a.rotSpeed * dt;
      if (a.dist > maxRadius) {
        // reached the cockpit unshot — the run ends here
        asteroids.splice(i, 1);
        gameOver();
        return;
      }

      var depth = a.dist / maxRadius;
      var ax = cx + Math.cos(a.angle) * a.dist;
      var ay = cy + Math.sin(a.angle) * a.dist;
      var radius = a.baseSize * depth;
      var alpha = Math.min(1, depth / 0.2);

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a.rotation);
      ctx.beginPath();
      for (var p = 0; p < a.shape.length; p++) {
        var pt = a.shape[p];
        var px = Math.cos(pt.a) * radius * pt.r;
        var py = Math.sin(pt.a) * radius * pt.r;
        if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(74, 66, 60, ' + alpha + ')';
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 130, 110, ' + (alpha * 0.7) + ')';
      ctx.lineWidth = Math.max(1, radius * 0.06);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- explosions (hit feedback) ---------------- */

  function spawnExplosion(x, y) {
    for (var i = 0; i < 12; i++) {
      var a = Math.random() * Math.PI * 2;
      var speed = 50 + Math.random() * 110;
      explosions.push({
        x: x, y: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0, maxLife: 0.4 + Math.random() * 0.25, size: 1.5 + Math.random() * 2.5
      });
    }
  }

  function updateExplosions(dt) {
    for (var i = explosions.length - 1; i >= 0; i--) {
      var p = explosions[i];
      p.life += dt;
      if (p.life > p.maxLife) { explosions.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      var t = 1 - p.life / p.maxLife;
      ctx.fillStyle = 'rgba(242, 168, 61, ' + t + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------- reticle + firing ---------------- */

  function updateReticle(dt) {
    var dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (dx || dy) {
      var len = Math.hypot(dx, dy);
      var speed = Math.min(w, h) * 0.9;
      reticle.targetX += (dx / len) * speed * dt;
      reticle.targetY += (dy / len) * speed * dt;
    }
    reticle.targetX = clamp(reticle.targetX, -w * RETICLE_BOUND_X, w * RETICLE_BOUND_X);
    reticle.targetY = clamp(reticle.targetY, -h * RETICLE_BOUND_Y, h * RETICLE_BOUND_Y);
    var ease = 1 - Math.pow(1 - 0.3, dt * 60);
    reticle.x += (reticle.targetX - reticle.x) * ease;
    reticle.y += (reticle.targetY - reticle.y) * ease;
  }

  function drawReticle(cx, cy) {
    var x = cx + reticle.x, y = cy + reticle.y;
    ctx.save();
    ctx.strokeStyle = 'rgba(94, 200, 234, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.moveTo(x - 24, y); ctx.lineTo(x - 8, y);
    ctx.moveTo(x + 8, y); ctx.lineTo(x + 24, y);
    ctx.moveTo(x, y - 24); ctx.lineTo(x, y - 8);
    ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 24);
    ctx.stroke();
    ctx.restore();
  }

  function fire(cx, cy) {
    if (state !== 'playing') return;
    var rx = cx + reticle.x, ry = cy + reticle.y;
    var best = -1, bestDist = Infinity;
    for (var i = 0; i < asteroids.length; i++) {
      var a = asteroids[i];
      var depth = a.dist / maxRadius;
      var ax = cx + Math.cos(a.angle) * a.dist;
      var ay = cy + Math.sin(a.angle) * a.dist;
      var radius = a.baseSize * Math.max(0.15, depth);
      var hitR = radius + 30; // forgiving margin — near-misses still count
      var d = Math.hypot(ax - rx, ay - ry);
      if (d < hitR && d < bestDist) { bestDist = d; best = i; }
    }
    if (best >= 0) {
      var hit = asteroids[best];
      var hx = cx + Math.cos(hit.angle) * hit.dist;
      var hy = cy + Math.sin(hit.angle) * hit.dist;
      spawnExplosion(hx, hy);
      asteroids.splice(best, 1);
      score++;
      scoreEl.textContent = 'Destroyed: ' + score;
    }
  }

  /* ---------------- state machine ---------------- */

  function goReady() {
    state = 'ready';
    promptEl.hidden = false;
  }

  function startGame() {
    state = 'playing';
    promptEl.hidden = true;
    gameoverEl.hidden = true;
    scoreEl.hidden = false;
    asteroids = [];
    explosions = [];
    gameTime = 0;
    score = 0;
    spawnTimer = 0.7;
    scoreEl.textContent = 'Destroyed: 0';
  }

  function gameOver() {
    state = 'gameover';
    scoreEl.hidden = true;
    var hs = getHighScore();
    var isNew = score > hs;
    if (isNew) setHighScore(score);
    gameoverScoreEl.textContent = isNew
      ? 'New best — ' + score + ' destroyed'
      : score + ' destroyed (best ' + Math.max(hs, score) + ')';
    gameoverEl.hidden = false;
  }

  /* ---------------- main loop ---------------- */

  function frame(t) {
    if (!lastT) lastT = t;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    var elapsed = t - openedAt;
    var mult = speedMultiplier(elapsed);
    var sec = elapsed / 1000;

    if (state === 'intro' && elapsed >= READY_DELAY_MS) goReady();

    var cx = w / 2 + Math.sin(sec / 14) * (w * 0.015);
    var cy = h * 0.5 + Math.sin(sec / 11 + 1.3) * (h * 0.015);

    ctx.clearRect(0, 0, w, h);
    drawStars(cx, cy, dt, mult);

    if (state === 'playing') {
      gameTime += dt;
      updateReticle(dt);
      updateAsteroids(dt, cx, cy);
      if (state === 'playing') {
        updateExplosions(dt);
        drawReticle(cx, cy);
      }
    } else if (state === 'ready' || state === 'gameover') {
      updateReticle(dt);
      updateExplosions(dt);
      drawReticle(cx, cy);
    }

    raf = requestAnimationFrame(frame);
  }

  /* ---------------- input ---------------- */

  function keyName(e) {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') return 'up';
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') return 'down';
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') return 'left';
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') return 'right';
    return null;
  }

  function centerPoint() {
    var sec = (performance.now() - openedAt) / 1000;
    return {
      cx: w / 2 + Math.sin(sec / 14) * (w * 0.015),
      cy: h * 0.5 + Math.sin(sec / 11 + 1.3) * (h * 0.015)
    };
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { close(); return; }
    var dir = keyName(e);
    if (dir) {
      keys[dir] = true;
      e.preventDefault();
      if (state === 'ready') startGame();
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (state === 'ready') { startGame(); return; }
      if (state === 'gameover') { startGame(); return; }
      var c = centerPoint();
      fire(c.cx, c.cy);
      return;
    }
    if (state === 'gameover') startGame();
  }

  function onKeyup(e) {
    var dir = keyName(e);
    if (dir) keys[dir] = false;
  }

  function pointerPos(e) {
    var rect = scene.getBoundingClientRect();
    return {
      x: clamp(e.clientX - (rect.left + rect.width / 2), -w * RETICLE_BOUND_X, w * RETICLE_BOUND_X),
      y: clamp(e.clientY - (rect.top + rect.height / 2), -h * RETICLE_BOUND_Y, h * RETICLE_BOUND_Y)
    };
  }

  function onPointerDown(e) {
    pointerActive = true;
    pointerId = e.pointerId;
    try { scene.setPointerCapture(pointerId); } catch (err) { /* noop */ }
    var p = pointerPos(e);
    reticle.targetX = reticle.x = p.x;
    reticle.targetY = reticle.y = p.y;
    if (state === 'ready' || state === 'gameover') { startGame(); return; }
    var c = centerPoint();
    fire(c.cx, c.cy);
  }

  function onPointerMove(e) {
    if (!pointerActive || e.pointerId !== pointerId) return;
    var p = pointerPos(e);
    reticle.targetX = p.x; reticle.targetY = p.y;
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerActive = false;
    pointerId = null;
  }

  /* ---------------- open / close ---------------- */

  function open() {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    sizeCanvas();
    initStars();
    asteroids = [];
    explosions = [];
    state = 'intro';
    gameTime = 0;
    score = 0;
    reticle.x = reticle.y = reticle.targetX = reticle.targetY = 0;
    promptEl.hidden = true;
    gameoverEl.hidden = true;
    scoreEl.hidden = true;
    openedAt = performance.now();
    lastT = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('keyup', onKeyup);
    scene.addEventListener('pointerdown', onPointerDown);
    scene.addEventListener('pointermove', onPointerMove);
    scene.addEventListener('pointerup', onPointerUp);
    scene.addEventListener('pointercancel', onPointerUp);
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('keyup', onKeyup);
    scene.removeEventListener('pointerdown', onPointerDown);
    scene.removeEventListener('pointermove', onPointerMove);
    scene.removeEventListener('pointerup', onPointerUp);
    scene.removeEventListener('pointercancel', onPointerUp);
    trigger.focus();
  }

  trigger.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  window.addEventListener('resize', function () {
    if (overlay.classList.contains('is-open')) sizeCanvas();
  });
})();
