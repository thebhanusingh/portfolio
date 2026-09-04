/**
 * 3D hover-tilt for project cards.
 *
 * Tracks the cursor position within each `.project-card` and writes three
 * CSS custom properties (--rx, --ry, --tilt-scale) that css/style.css reads
 * from in the card's `transform`. This file only computes numbers — the
 * actual rendering (including the reduced-motion fallback) lives in CSS.
 *
 * While the pointer is moving, the `.is-tilting` class drops `transform`
 * out of the card's transition list (see style.css) so the tilt tracks the
 * cursor instantly instead of chasing it with a lag. On mouseleave the
 * class comes off and the values reset to neutral, so the card's normal
 * (slower) transition eases it back flat.
 *
 * Skipped entirely on touch devices (no hover to track) and when the user
 * has requested reduced motion.
 */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return;

  var MAX_TILT = 7; // degrees, kept subtle on purpose

  document.querySelectorAll('.project-card').forEach(function (card) {
    function onEnter() {
      card.classList.add('is-tilting');
    }
    function onMove(e) {
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width;
      var y = (e.clientY - rect.top) / rect.height;
      var ry = (x - 0.5) * MAX_TILT * 2;
      var rx = (0.5 - y) * MAX_TILT * 2;
      card.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      card.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      card.style.setProperty('--tilt-scale', '1.02');
    }
    function onLeave() {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--tilt-scale', '1');
    }
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  });
})();
