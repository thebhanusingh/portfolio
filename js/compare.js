/** Before/after compare slider: the range input drives --pos; one short sweep on first view. */
(function () {
  document.querySelectorAll('[data-compare]').forEach(function (box) {
    var range = box.querySelector('.compare__range');
    if (!range) return;
    var set = function (v) { box.style.setProperty('--pos', v + '%'); range.value = v; };
    var touched = false;
    range.addEventListener('input', function () { touched = true; set(range.value); });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      var start = null;
      var step = function (t) {
        if (touched) return;
        if (start === null) start = t;
        var p = Math.min((t - start) / 1800, 1);
        set(Math.round(50 - 28 * Math.sin(p * Math.PI * 2) * (1 - p * 0.3)));
        if (p < 1) requestAnimationFrame(step); else set(50);
      };
      setTimeout(function () { requestAnimationFrame(step); }, 500);
    }, { threshold: 0.6 });
    io.observe(box);
  });
})();
