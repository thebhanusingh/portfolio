/**
 * Interactive night-street hero.
 * - Click/tap a lamp to switch it on or off.
 * - Click/tap a prop (bin, signpost) to spin it a quarter turn.
 * - Drag (or use the arrow buttons / arrow keys) to walk down the street.
 *
 * Activation is driven off pointerdown/pointerup coordinates rather than the
 * browser's synthesized `click` event: in some environments the click event
 * gets retargeted to the scroll container mid-gesture, which would silently
 * eat every tap. Comparing where the press started and released sidesteps
 * that entirely and doubles as our own "was this a drag?" check.
 */
(function () {
  var viewport = document.querySelector('.street-viewport');
  if (!viewport) return;

  var scene = viewport.querySelector('.street-scene');

  function toggleLamp(lamp) {
    lamp.classList.toggle('lit');
    syncLampLabel(lamp);
  }

  function syncLampLabel(lamp) {
    var lit = lamp.classList.contains('lit');
    var n = lamp.dataset.lamp || '';
    lamp.setAttribute('aria-pressed', String(lit));
    lamp.setAttribute('aria-label', 'Street lamp ' + n + ' — click to turn ' + (lit ? 'off' : 'on'));
  }

  function spinProp(prop) {
    var state = (parseInt(prop.dataset.state, 10) + 1) % 4;
    prop.dataset.state = String(state);
    applyPropRotation(prop);
  }

  function applyPropRotation(prop) {
    var deg = parseInt(prop.dataset.state, 10) * 90;
    prop.style.transform = 'rotate(' + deg + 'deg)';
    prop.setAttribute('aria-label', (prop.dataset.name || 'Street prop') + ' — click to turn it');
  }

  function activate(el) {
    if (!el) return;
    if (el.classList.contains('street-lamp')) toggleLamp(el);
    else if (el.classList.contains('street-prop')) spinProp(el);
  }

  /* ---- initial state + keyboard support ---- */
  scene.querySelectorAll('.street-lamp').forEach(function (lamp) {
    lamp.setAttribute('tabindex', '0');
    lamp.setAttribute('role', 'button');
    syncLampLabel(lamp);
    lamp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(lamp); }
    });
  });

  scene.querySelectorAll('.street-prop').forEach(function (prop) {
    prop.setAttribute('tabindex', '0');
    prop.setAttribute('role', 'button');
    prop.dataset.state = prop.dataset.state || '0';
    applyPropRotation(prop);
    prop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(prop); }
    });
  });

  /* ---- pointer handling: drag-to-pan + tap-to-activate ---- */
  var isDown = false;
  var startX = 0;
  var startY = 0;
  var startScroll = 0;
  var moved = false;
  var pressedTarget = null;

  viewport.addEventListener('pointerdown', function (e) {
    isDown = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startScroll = viewport.scrollLeft;
    pressedTarget = e.target.closest('.street-lamp, .street-prop');
  });

  viewport.addEventListener('pointermove', function (e) {
    if (!isDown) return;
    var dx = e.clientX - startX;
    if (!moved && Math.hypot(dx, e.clientY - startY) > 6) {
      moved = true;
      viewport.setAttribute('data-dragging', 'true');
      try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    if (moved) viewport.scrollLeft = startScroll - dx;
  });

  function endDrag(e) {
    if (isDown && !moved && pressedTarget) activate(pressedTarget);
    isDown = false;
    pressedTarget = null;
    viewport.removeAttribute('data-dragging');
    if (e && e.pointerId !== undefined) {
      try { viewport.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
  }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', function () { isDown = false; pressedTarget = null; viewport.removeAttribute('data-dragging'); });
  viewport.addEventListener('pointerleave', function (e) { if (isDown) endDrag(e); });

  /* ---- nudge buttons: click-based alternative to dragging ---- */
  document.querySelectorAll('.street-nudge').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dir = btn.dataset.dir === 'left' ? -1 : 1;
      viewport.scrollBy({ left: dir * 420, behavior: 'smooth' });
    });
  });

  /* ---- keyboard: arrow keys pan the street when it has focus ---- */
  viewport.setAttribute('tabindex', '0');
  viewport.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { viewport.scrollBy({ left: 200, behavior: 'smooth' }); }
    if (e.key === 'ArrowLeft') { viewport.scrollBy({ left: -200, behavior: 'smooth' }); }
  });
})();
