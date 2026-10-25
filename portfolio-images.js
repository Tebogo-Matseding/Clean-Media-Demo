/* portfolio-images.js
 * Shared by every page.
 *   1. window.CMP_IMG  - helpers that read portfolio-manifest.js (used by the #portfolio cards on index.html)
 *   2. Nav dropdown preview - hovering Corporate / Lifestyle / Events shows a random landscape photo
 *
 * Load it AFTER portfolio-manifest.js and give it the path back to the site root:
 *   <script src="portfolio-manifest.js"></script>
 *   <script src="portfolio-images.js" data-root=""></script>            (page in the site root)
 *   <script src="../portfolio-manifest.js"></script>
 *   <script src="../portfolio-images.js" data-root="../"></script>      (page inside a *-gallery folder)
 *
 * The nav markup it expects (already on every page): #portfolioDropdown, .nav-dd-group[data-group],
 * .nav-dd-parent, .nav-dd-cta, #navDdLinks, #navDdImg, #navDdImgB.
 */
(function () {
  var me   = document.currentScript;
  var ROOT = (me && me.getAttribute('data-root')) || '';
  var M    = window.PORTFOLIO_MANIFEST && window.PORTFOLIO_MANIFEST.categories;

  /* ---------- helpers ---------- */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // One list per sub-category (in manifest order), empty lists dropped
  function lists(cat, orient) {
    var c = M && M[cat];
    if (!c) return [];
    return Object.keys(c).map(function (k) { return c[k][orient] || []; })
                         .filter(function (l) { return l.length; });
  }

  function randomFrom(ls, avoid) {
    if (!ls.length) return null;
    var src = null;
    for (var t = 0; t < 4; t++) {
      var l = ls[Math.floor(Math.random() * ls.length)];
      src = ROOT + l[Math.floor(Math.random() * l.length)];
      if (src !== avoid) break;
    }
    return src;
  }

  window.CMP_IMG = {
    preload: function (src) {
      return new Promise(function (resolve) {
        var im = new Image();
        im.src = src;
        if (im.decode) {            // fully decoded before it is shown, so the fade never stalls
          im.decode().then(function () { resolve(src); }, function () { resolve(null); });
        } else {
          im.onload  = function () { resolve(src); };
          im.onerror = function () { resolve(null); };
        }
      });
    },
    // Nav preview: a random landscape photo from the category
    randomLandscape: function (cat, avoid) { return randomFrom(lists(cat, 'landscape'), avoid); },
    // Card resting image: a random portrait photo from the category
    randomPortrait:  function (cat, avoid) { return randomFrom(lists(cat, 'portrait'), avoid); },
    // Card slideshow: portraits taken round-robin from every sub-category, random within each
    portraitSequence: function (cat, max) {
      var ls = lists(cat, 'portrait').map(shuffle), out = [], i = 0;
      while (out.length < max) {
        var added = false;
        for (var k = 0; k < ls.length && out.length < max; k++) {
          if (i < ls[k].length) { out.push(ROOT + ls[k][i]); added = true; }
        }
        if (!added) break;
        i++;
      }
      return out;
    }
  };

  /* ---------- nav dropdown preview (desktop only) ---------- */
  function initNavPreview() {
    var wrap   = document.querySelector('.nav-dropdown-wrap');
    var imgs   = [document.getElementById('navDdImg'), document.getElementById('navDdImgB')];
    var linksEl = document.getElementById('navDdLinks');
    if (!wrap || !imgs[0] || !imgs[1]) return;

    var TABLET_MAX = 1024;                       // must match the CSS breakpoint
    function isDesktop() { return window.innerWidth > TABLET_MAX; }

    var defaultSrc = imgs[0].getAttribute('src') || '';   // the logo shown when nothing is hovered
    var active = 0, runId = 0;

    function show(src) {
      var next = imgs[1 - active], cur = imgs[active];
      if (cur.getAttribute('src') !== src) {
        next.src = src;
        next.classList.toggle('is-logo', src === defaultSrc);
        next.classList.add('is-shown');
        cur.classList.remove('is-shown');
        active = 1 - active;
      }
    }

    function reset() { runId++; show(defaultSrc); }

    function showCategory(item) {
      if (!isDesktop()) return;
      var id    = ++runId;
      var group = item.closest('.nav-dd-group');
      var cat   = group ? group.getAttribute('data-group') : '';
      var pick  = cat ? window.CMP_IMG.randomLandscape(cat, imgs[active].getAttribute('src')) : null;
      var fallback = item.getAttribute('data-img') || defaultSrc;
      if (!pick) { show(fallback); return; }               // no manifest / no landscapes -> fallback
      window.CMP_IMG.preload(pick).then(function (ok) {
        if (id !== runId) return;
        show(ok || fallback);
      });
    }

    document.querySelectorAll('.nav-dd-parent, .nav-dd-cta').forEach(function (it) {
      it.addEventListener('mouseenter', function () { showCategory(this); });
      it.addEventListener('focus',      function () { showCategory(this); });
    });
    if (linksEl) linksEl.addEventListener('mouseleave', function () { if (isDesktop()) reset(); });

    // Back to the logo whenever the dropdown closes (the page's own open/close code needs no change)
    new MutationObserver(function () {
      if (!wrap.classList.contains('is-open')) reset();
    }).observe(wrap, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNavPreview);
  else initNavPreview();
})();
