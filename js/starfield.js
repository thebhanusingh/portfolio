/**
 * Ambient starfield — sits behind every page, between the per-page
 * gradient wash (css/style.css, body::before) and the real content.
 *
 * Deliberately understated: this is NOT the cockpit easter egg's warp
 * effect (js/cockpit.js) — no streaks, no radial burst, nothing that
 * competes with reading a paragraph. Each star just twinkles (a slow
 * per-star opacity sine wave) and the whole field drifts a handful of
 * pixels over a couple of minutes, wrapping at the edges — enough to
 * read as "space," not enough to be a distraction on a page of prose.
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

  // whole-field drift: pixels per second, wraps at the edges
  var DRIFT_X = 0.9;
  var DRIFT_Y = 0.35;

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
    var count = Math.max(36, Math.min(90, Math.round((w * h) / 22000)));
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.5 + Math.random() * 1.3,
        baseAlpha: 0.25 + Math.random() * 0.45,
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
      var x = (s.x + sec * DRIFT_X) % (w + 20);
      var y = (s.y + sec * DRIFT_Y) % (h + 20);
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
