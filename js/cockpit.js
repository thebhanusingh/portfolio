/**
 * Cockpit easter egg — click the jet icon next to "See the work" to fly
 * toward the Pillars of Creation.
 *
 * The nebula photo and the canopy frame are static (CSS/SVG); this file
 * drives the starfield on <canvas> and the open/close behavior.
 *
 * Each star is tracked as an angle + distance-from-center (depth stands in
 * for "how far out/close it is"), plus a small per-star angular drift so
 * the field doesn't move in perfectly rigid straight lines — that little
 * bit of independent motion is most of what reads as "3D" rather than a
 * flat radial pattern. Every star is drawn as a circle sized and lit by
 * its depth (near = bigger/brighter, far = a dim pinprick), with a
 * trailing line added on top only when it's moving fast enough for a
 * streak to read — so the same system produces both the hyperspace-jump
 * burst on open and the calm, dimensional drift it settles into.
 *
 * The vanishing point itself sways very slightly on two independent slow
 * sine waves (different periods so it doesn't repeat in an obvious loop),
 * like a barely-there handheld drift rather than a perfectly locked-off
 * camera — small enough to stay subtle, present enough to keep the scene
 * feeling flown rather than static.
 *
 * Motion timeline after opening: ~2.2s of full-speed warp-in, then a ~1.6s
 * ease down into a slow permanent cruise so the nebula stays the visual
 * focus, not the starfield. Respects prefers-reduced-motion by skipping
 * the warp-in and starting straight at the slow cruise speed.
 */
(function () {
  var trigger = document.getElementById('cockpit-trigger');
  var overlay = document.getElementById('cockpit-overlay');
  var closeBtn = document.getElementById('cockpit-close');
  var canvas = document.getElementById('cockpit-canvas');
  if (!trigger || !overlay || !closeBtn || !canvas) return;

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var WARP_MS = 2200;
  var SETTLE_MS = 1600;
  var CRUISE_MULT = 0.11;

  var stars = [];
  var raf = null;
  var openedAt = 0;
  var lastT = 0;
  var w = 0, h = 0, maxRadius = 0;

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

  function resetStar(s, spawnNearCenter) {
    s.angle = Math.random() * Math.PI * 2;
    s.dist = spawnNearCenter ? Math.random() * 40 : Math.random() * maxRadius;
    s.speed = 70 + Math.random() * 110; // px/sec at full warp
    s.angularVel = (Math.random() - 0.5) * 0.22; // rad/sec — the "not a rigid line" drift
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

  function frame(t) {
    if (!lastT) lastT = t;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    var elapsed = t - openedAt;
    var mult = speedMultiplier(elapsed);
    var sec = elapsed / 1000;

    // vanishing point: a barely-there sway, two mismatched periods so it
    // doesn't read as a simple repeating circle
    var cx = w / 2 + Math.sin(sec / 14) * (w * 0.015);
    var cy = h * 0.5 + Math.sin(sec / 11 + 1.3) * (h * 0.015);

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var prevDist = s.dist;
      s.angle += s.angularVel * dt * (0.4 + mult); // drift is subtlest at full warp, most present at cruise
      s.dist += s.speed * mult * dt * 5;
      if (s.dist > maxRadius) {
        resetStar(s, true);
        continue;
      }

      var cosA = Math.cos(s.angle);
      var sinA = Math.sin(s.angle);
      var hx = cx + cosA * s.dist;
      var hy = cy + sinA * s.dist;

      var depth = s.dist / maxRadius;
      var alpha = Math.min(1, depth / 0.28);
      var radius = 0.5 + depth * depth * 2.6; // near stars grow faster than far ones — real depth cue
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
    raf = requestAnimationFrame(frame);
  }

  function open() {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    sizeCanvas();
    initStars();
    openedAt = performance.now();
    lastT = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    document.addEventListener('keydown', onKeydown);
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    document.removeEventListener('keydown', onKeydown);
    trigger.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
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
