/**
 * Ambient color — makes the background gradient react to whatever image or
 * video is actually on screen, instead of staying a fixed per-page hue.
 *
 * How it picks a color: every <img>/<video> inside <main> is watched with
 * an IntersectionObserver tuned to a band near the top of the viewport.
 * Whenever one crosses into that band, it gets sampled — drawn into a
 * tiny (16×10) offscreen canvas, which forces the browser to downscale
 * and blend it, then the pixels are averaged. That average becomes two
 * CSS custom properties (--amb-color-1/2, registered via @property in
 * style.css so the color itself can transition smoothly rather than
 * snap). No image library, no build step — just a canvas doing the
 * averaging for free as a side effect of drawing small.
 *
 * A page with no media in <main> (About, Contact) never calls
 * applyColor, so the static per-page gradient from style.css is simply
 * left alone.
 *
 * Videos usually can't be sampled immediately — most on this site use
 * preload="none" and don't have a decoded frame until the viewer presses
 * play — so a video only contributes once its 'loadeddata' event fires;
 * until then it's skipped in favor of whatever image is already in view.
 */
(function () {
  if (!('IntersectionObserver' in window)) return;

  var root = document.documentElement;
  var current = null;

  function sample(el) {
    try {
      var c = document.createElement('canvas');
      c.width = 16;
      c.height = 10;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(el, 0, 0, 16, 10);
      var data = ctx.getImageData(0, 0, 16, 10).data;
      var r = 0, g = 0, b = 0, n = 0;
      for (var i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue; // skip near-transparent pixels
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      if (!n) return null;
      return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    } catch (e) {
      return null; // cross-origin or decode failure — leave the fallback wash alone
    }
  }

  function applyColor(color) {
    root.style.setProperty('--amb-color-1', 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0.42)');
    root.style.setProperty('--amb-color-2', 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0.24)');
  }

  function isReady(el) {
    return el.tagName === 'IMG' ? (el.complete && el.naturalWidth > 0) : el.readyState >= 2;
  }

  function tryElement(el) {
    if (el === current || !isReady(el)) return;
    var color = sample(el);
    if (color) {
      current = el;
      applyColor(color);
    }
  }

  var observer = new IntersectionObserver(function (entries) {
    var best = null;
    var bestDist = Infinity;
    var viewportMid = window.innerHeight / 2;
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var elMid = entry.boundingClientRect.top + entry.boundingClientRect.height / 2;
      var dist = Math.abs(elMid - viewportMid);
      if (dist < bestDist) {
        bestDist = dist;
        best = entry.target;
      }
    });
    if (best) tryElement(best);
    // whatever's centered in the viewport right now drives the color — not
    // whatever's nearest the top edge — since that's where someone's
    // attention actually is while reading or watching
  }, { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.1, 0.3] });

  document.querySelectorAll('main img, main video').forEach(function (el) {
    observer.observe(el);
    if (el.tagName === 'IMG') {
      if (el.complete) tryElement(el);
      else el.addEventListener('load', function () { tryElement(el); }, { once: true });
    } else {
      el.addEventListener('loadeddata', function () { tryElement(el); }, { once: true });
    }
  });
})();
