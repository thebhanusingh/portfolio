/**
 * Ambient starfield — sits behind every page, between the per-page
 * gradient wash (css/style.css, body::before) and the real content.
 *
 * Deliberately understated: this is NOT the cockpit easter egg's warp
 * effect (js/cockpit.js) — no streaks, no radial burst, nothing that
 * competes with reading a paragraph. What it IS is a real parallax
 * field: every star carries a depth (0.25–1), and drifts sideways at a
 * speed proportional to that depth — near stars (bigger, brighter) glide
 * past noticeably faster than far ones (smaller, dimmer), the same
 * near/far cue the cockpit's warp settles into, just slower and with no
 * radial burst. Each star also twinkles independently on top of that
 * drift. The combination is what actually reads as motion rather than a
 * static field with a shimmer.
 *
 * Self-injecting: any page just needs `<script src=".../starfield.js">`,
 * no markup. Builds its own canvas and appends it as the first child of
 * <body> (z-index handled in CSS). Pauses via the Page Visibility API
 * when the tab isn't active, and renders a single static frame (no loop
 * at all) for prefers-reduced-motion.
 */
(function () {
  var canvas = document.createElement('canvas');
  canvas.className = 'starfield-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var stars = [];
  var w = 0, h = 0;
  var raf = null;
  var startT = 0;

  // drift speed (px/sec) at depth=1 (nearest); each star's actual speed
  // is this times its own depth, so near/far stars visibly separate
  // instead of moving as one flat sheet
  var DRIFT_X = 9;
  var DRIFT_Y = 3;

  function sizeCanvas() {
    w = window.innerWidth;
    h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeStars() {
    // scales with viewport area — a phone naturally lands near the floor,
    // a desktop near the ceiling, keeping per-frame canvas work light
    // either way
    var count = Math.max(20, Math.min(90, Math.round((w * h) / 22000)));
    stars = [];
    for (var i = 0; i < count; i++) {
      var depth = 0.25 + Math.random() * 0.75; // 0.25 (far) – 1 (near)
      stars.push({
        x: Math.random() * (w + 40) - 20,
        y: Math.random() * h,
        depth: depth,
        r: 0.4 + depth * 1.4,
        baseAlpha: (0.2 + depth * 0.5),
        period: 3 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.12
      });
    }
  }

  function drawStatic() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var color = s.warm ? '255, 214, 170' : '255, 255, 255';
      ctx.fillStyle = 'rgba(' + color + ', ' + s.baseAlpha + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(t) {
    if (!startT) startT = t;
    var sec = (t - startT) / 1000;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var span = w + 40;
      var x = ((s.x + 20 + sec * DRIFT_X * s.depth) % span + span) % span - 20;
      var y = ((s.y + sec * DRIFT_Y * s.depth) % (h + 20) + (h + 20)) % (h + 20);
      var alpha = s.baseAlpha * (0.55 + 0.45 * Math.sin(sec / s.period + s.phase));
      var color = s.warm ? '255, 214, 170' : '255, 255, 255';
      ctx.fillStyle = 'rgba(' + color + ', ' + Math.max(0, alpha) + ')';
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf) return;
    if (reduceMotion) { drawStatic(); return; }
    startT = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  sizeCanvas();
  makeStars();
  if (reduceMotion) {
    drawStatic();
  } else {
    start();
  }

  window.addEventListener('resize', function () {
    sizeCanvas();
    makeStars();
    if (reduceMotion) drawStatic();
  });

  document.addEventListener('visibilitychange', function () {
    if (reduceMotion) return;
    if (document.hidden) stop();
    else start();
  });
})();
