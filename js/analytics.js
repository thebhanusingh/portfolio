/**
 * Visitor analytics (Umami Cloud).
 *
 * Umami records page views, sessions, referrers, countries and devices on
 * its own. This file adds what it can't see by itself:
 *   page-exit       engaged time on the page, max scroll, time bucket
 *   scroll-depth    25 / 50 / 75 / 100 % milestones
 *   section-view    an h2 section stayed on screen for 1s+
 *   card-view       a project/research card stayed on screen for 1s+
 *   media-view      an image or video stayed on screen for 1.5s+
 *   video-play      first play of a video
 *   video-progress  25 / 50 / 75 / 100 % of a video watched
 *   card-click      which card a visitor opened, and from where
 *   email-click, resume-download, file-download, outbound-click
 *
 * Setup: paste the Website ID from Umami (Settings -> Websites -> Edit)
 * into UMAMI_WEBSITE_ID. Until then this file does nothing.
 *
 * To keep your own visits out of the data, open any page once with
 * ?notrack (undo with ?track). Add ?analytics-debug to log events to the
 * browser console.
 */
(function () {
  var UMAMI_WEBSITE_ID = '';
  var UMAMI_SRC = 'https://cloud.umami.is/script.js';
  // Comma-separated hostnames to record, e.g. 'bhanusingh.com,www.bhanusingh.com'.
  // Empty = any host except localhost.
  var UMAMI_DOMAINS = '';

  var IDLE_AFTER_MS = 60000;
  var SECTION_DWELL_MS = 1000;
  var MEDIA_DWELL_MS = 1500;

  var params = new URLSearchParams(location.search);
  var debug = params.has('analytics-debug');

  function storage(fn) {
    try { return fn(window.localStorage); } catch (e) { return null; }
  }
  if (params.has('notrack')) storage(function (s) { s.setItem('umami.disabled', '1'); });
  if (params.has('track')) storage(function (s) { s.removeItem('umami.disabled'); });

  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
  var enabled = !!UMAMI_WEBSITE_ID && (!isLocal || debug);
  if (!enabled) return;

  /* ---------- sending ---------- */

  var queue = [];
  var ready = false;

  function send(name, data) {
    if (debug) console.log('[analytics]', name, data);
    if (ready && window.umami) window.umami.track(name, data);
    else queue.push([name, data]);
  }

  function flush() {
    ready = true;
    if (!window.umami) return;
    queue.splice(0).forEach(function (e) { window.umami.track(e[0], e[1]); });
  }

  if (!isLocal) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = UMAMI_SRC;
    s.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
    if (UMAMI_DOMAINS) s.setAttribute('data-domains', UMAMI_DOMAINS);
    // Queued events go out after the page view so a session reads in order.
    s.onload = function () {
      if (document.readyState === 'complete') setTimeout(flush, 400);
      else window.addEventListener('load', function () { setTimeout(flush, 400); });
    };
    document.head.appendChild(s);
  }

  /* ---------- helpers ---------- */

  var page = location.pathname.replace(/^\/+|\.html$/g, '').replace(/(^|\/)index$/, '$1') || 'home';
  page = page.replace(/\/$/, '') || 'home';

  // Umami rejects strings that start with a spreadsheet formula character.
  function clean(text, max) {
    text = String(text || '').replace(/\s+/g, ' ').trim().replace(/^[=+\-@]+\s*/, '');
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function fileName(url) {
    return clean(decodeURIComponent(String(url).split(/[?#]/)[0].split('/').pop()), 120);
  }

  function mediaName(el) {
    var fig = el.closest('figure');
    var cap = fig && fig.querySelector('figcaption');
    if (cap && cap.textContent.trim()) return clean(cap.textContent, 120);
    if (el.tagName === 'IMG') return clean(el.getAttribute('alt') || fileName(el.currentSrc || el.src), 120);
    var src = el.currentSrc || (el.querySelector('source') || {}).src || el.getAttribute('poster') || '';
    return fileName(src);
  }

  function cardName(card) {
    var h = card.querySelector('h3, h2');
    return clean(h ? h.textContent : card.getAttribute('href'), 120);
  }

  /* ---------- engaged time + scroll ---------- */

  var engagedMs = 0;
  var lastTick = Date.now();
  var lastActivity = Date.now();
  var maxScroll = 0;
  var sentAtMs = -1;
  var videos = document.getElementsByTagName('video');

  function videoPlaying() {
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (!v.paused && !v.ended && v.readyState > 2) return true;
    }
    return false;
  }

  function isEngaged(now) {
    return document.visibilityState === 'visible' && (now - lastActivity < IDLE_AFTER_MS || videoPlaying());
  }

  function tick() {
    var now = Date.now();
    if (isEngaged(now)) engagedMs += Math.min(now - lastTick, 5000);
    lastTick = now;
  }
  setInterval(tick, 1000);

  ['mousemove', 'keydown', 'scroll', 'touchstart', 'pointerdown', 'wheel'].forEach(function (type) {
    window.addEventListener(type, function () { lastActivity = Date.now(); }, { passive: true });
  });

  var scrollMarks = [25, 50, 75, 100];
  function measureScroll() {
    var doc = document.documentElement;
    var total = doc.scrollHeight - window.innerHeight;
    var pct = total <= 0 ? 100 : Math.round((window.scrollY / total) * 100);
    pct = Math.max(0, Math.min(100, pct));
    if (pct > maxScroll) maxScroll = pct;
    while (scrollMarks.length && maxScroll >= scrollMarks[0]) {
      send('scroll-depth', { page: page, depth: scrollMarks.shift() });
    }
  }
  var scrollQueued = false;
  window.addEventListener('scroll', function () {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () { scrollQueued = false; measureScroll(); });
  }, { passive: true });
  window.addEventListener('load', measureScroll);

  function bucket(sec) {
    if (sec < 10) return '0-10s';
    if (sec < 30) return '10-30s';
    if (sec < 60) return '30-60s';
    if (sec < 180) return '1-3m';
    if (sec < 600) return '3-10m';
    return '10m+';
  }

  // Fires each time the page is hidden (tab switch, close, or navigating
  // away). Values are running totals, so the last page-exit per view wins.
  function sendExit() {
    tick();
    if (engagedMs - sentAtMs < 1000) return;
    sentAtMs = engagedMs;
    var sec = Math.round(engagedMs / 1000);
    send('page-exit', { page: page, engaged_seconds: sec, time_bucket: bucket(sec), max_scroll: maxScroll });
    if (!ready && window.umami) flush();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendExit();
    else lastTick = lastActivity = Date.now();
  });
  window.addEventListener('pagehide', sendExit);

  /* ---------- what was on screen ---------- */

  function watchSeen(elements, dwellMs, onSeen) {
    if (!('IntersectionObserver' in window) || !elements.length) return;
    var timers = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        // Tall elements can never be 50% visible, so also accept "fills half the screen".
        var visible = entry.isIntersecting &&
          (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= window.innerHeight * 0.5);
        if (visible && !timers.has(el)) {
          timers.set(el, setTimeout(function () {
            if (document.visibilityState !== 'visible') { timers.delete(el); return; }
            io.unobserve(el);
            onSeen(el);
          }, dwellMs));
        } else if (!visible && timers.has(el)) {
          clearTimeout(timers.get(el));
          timers.delete(el);
        }
      });
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    elements.forEach(function (el) { io.observe(el); });
  }

  function init() {
    var main = document.querySelector('main') || document.body;
    var cards = Array.prototype.slice.call(main.querySelectorAll('a.card, .project-card'));

    watchSeen(Array.prototype.slice.call(main.querySelectorAll('h2')), SECTION_DWELL_MS, function (h) {
      send('section-view', { page: page, section: clean(h.textContent, 120) });
    });

    watchSeen(cards, SECTION_DWELL_MS, function (card) {
      send('card-view', { page: page, card: cardName(card), position: cards.indexOf(card) + 1 });
    });

    var media = Array.prototype.slice.call(main.querySelectorAll('img, video')).filter(function (el) {
      return !el.closest('a.card, .project-card') && !el.closest('[hidden]');
    });
    watchSeen(media, MEDIA_DWELL_MS, function (el) {
      send('media-view', { page: page, type: el.tagName === 'VIDEO' ? 'video' : 'image', name: mediaName(el) });
    });

    Array.prototype.slice.call(document.querySelectorAll('video')).forEach(function (video) {
      var started = false;
      var marks = [25, 50, 75, 100];
      video.addEventListener('play', function () {
        if (started) return;
        started = true;
        send('video-play', { page: page, name: mediaName(video) });
      });
      video.addEventListener('timeupdate', function () {
        if (!video.duration || !isFinite(video.duration)) return;
        var pct = (video.currentTime / video.duration) * 100;
        if (video.ended) pct = 100;
        while (marks.length && pct >= marks[0] - 0.5) {
          send('video-progress', { page: page, name: mediaName(video), percent: marks.shift() });
        }
      });
    });

    measureScroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* ---------- clicks ---------- */

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    var url;
    try { url = new URL(href, location.href); } catch (err) { return; }

    if (url.protocol === 'mailto:') {
      send('email-click', { page: page });
    } else if (/résumé|resume/i.test(url.pathname + ' ' + link.textContent) && /\.pdf$/i.test(url.pathname)) {
      send('resume-download', { page: page });
    } else if (/\.(pdf|zip|pptx?|docx?|mp4|mov)$/i.test(url.pathname)) {
      send('file-download', { page: page, file: fileName(url.pathname) });
    } else if (url.origin !== location.origin) {
      send('outbound-click', { page: page, url: clean(url.hostname + url.pathname, 200) });
    } else if (link.matches('a.card, .project-card')) {
      send('card-click', { page: page, card: cardName(link) });
    }
  }, true);
})();
