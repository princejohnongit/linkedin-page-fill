/**
 * LinkedIn Clean Feed – Content Script  (v2 – 2026 DOM)
 * ======================================================
 * LinkedIn now uses hashed CSS classes and this DOM structure:
 *
 *   main#workspace
 *     └─ div (wrapper)
 *         └─ div (layout container, 3 children)
 *             ├─ aside   (left sidebar / profile)
 *             ├─ section (feed)
 *             │    └─ div
 *             │        ├─ div (sort bar)
 *             │        └─ div
 *             │            └─ div (feed list, N children = posts)
 *             └─ aside   (right sidebar / news)
 *
 * Detection relies on semantic tags (main, aside, section)
 * rather than class names.
 */

(function () {
  'use strict';

  // Prevent double-init
  if (window.__lcfContentLoaded) return;
  window.__lcfContentLoaded = true;

  /* ---- Logging ---- */
  const P = '[LCF]';
  const log  = (...a) => console.log(P, ...a);
  const warn = (...a) => console.warn(P, ...a);
  const err  = (...a) => console.error(P, ...a);

  log('Content script loaded.  URL:', location.href);

  /* ---- Helpers ---- */

  /** Wait for a selector to appear in the DOM. */
  function waitFor(selectorOrFn, timeout) {
    timeout = timeout || 20000;
    return new Promise(function (resolve, reject) {
      var test = typeof selectorOrFn === 'function'
        ? selectorOrFn
        : function () { return document.querySelector(selectorOrFn); };

      var el = test();
      if (el) return resolve(el);

      var observer = new MutationObserver(function () {
        var el = test();
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });

      setTimeout(function () { observer.disconnect(); reject(new Error('waitFor timeout')); }, timeout);
    });
  }

  /** Unlock max-width on an element and all its ancestors up to body. */
  function unlockWidth(el) {
    while (el && el !== document.body) {
      el.style.setProperty('max-width', '100%', 'important');
      el.style.setProperty('width', '100%', 'important');
      el.setAttribute('data-lcf-unlock', '1');
      el = el.parentElement;
    }
  }

  /** Simple check: are we on the feed page? */
  function isFeed() {
    var p = location.pathname;
    return p === '/' || p.indexOf('/feed') === 0;
  }

  /* ---- Layout detection ---- */

  /**
   * Find the three-panel layout container.
   * It's the first descendant of <main> that has >=2 children where
   * at least one is <aside> and one is <section>.
   */
  function findLayoutContainer() {
    var main = document.querySelector('main');
    if (!main) return null;

    // BFS through main's descendants (shallow – max depth 4)
    var queue = [main];
    for (var depth = 0; depth < 4; depth++) {
      var next = [];
      for (var i = 0; i < queue.length; i++) {
        var el = queue[i];
        var children = el.children;
        if (children.length >= 2) {
          var hasAside = false, hasSection = false;
          for (var j = 0; j < children.length; j++) {
            var tag = children[j].tagName;
            if (tag === 'ASIDE') hasAside = true;
            if (tag === 'SECTION') hasSection = true;
          }
          if (hasAside && hasSection) {
            log('Layout container found at depth', depth, '– children:', children.length);
            return el;
          }
        }
        for (var k = 0; k < children.length; k++) next.push(children[k]);
      }
      queue = next;
    }
    return null;
  }

  /**
   * Within the <section> (feed area), find the feed list – the deepest
   * div with many children (the actual post list).
   */
  function findFeedList(section) {
    if (!section) return null;

    // Walk down: section > div > ... find the div with the most children
    var best = null;
    var bestCount = 0;

    function walk(el, depth) {
      if (depth > 6) return;
      var children = el.children;
      if (children.length > bestCount && el.tagName === 'DIV') {
        best = el;
        bestCount = children.length;
      }
      for (var i = 0; i < children.length; i++) {
        walk(children[i], depth + 1);
      }
    }
    walk(section, 0);

    if (best && bestCount >= 2) {
      log('Feed list found –', bestCount, 'children');
      return best;
    }
    return null;
  }

  /* ---- Apply layout ---- */

  function applyLayout(layoutContainer) {
    var children = layoutContainer.children;
    var leftAside = null, section = null, rightAside = null;

    for (var i = 0; i < children.length; i++) {
      var tag = children[i].tagName;
      if (tag === 'ASIDE' && !leftAside) leftAside = children[i];
      else if (tag === 'ASIDE') rightAside = children[i];
      else if (tag === 'SECTION') section = children[i];
    }

    // Determine column count
    var cols = (leftAside ? 1 : 0) + 1 + (rightAside ? 1 : 0);

    // Tag elements for CSS
    layoutContainer.setAttribute('data-lcf-role', 'layout');
    layoutContainer.setAttribute('data-lcf-cols', String(cols));
    if (leftAside) leftAside.setAttribute('data-lcf-role', 'sidebar');
    if (section) section.setAttribute('data-lcf-role', 'main');
    if (rightAside) rightAside.setAttribute('data-lcf-role', 'aside');

    // Unlock ancestor widths
    unlockWidth(layoutContainer);

    // Apply grid layout using CSS variables so user can tweak everything in styles.css
    var colTemplate = '';
    if (leftAside) colTemplate += 'var(--lcf-left-sidebar-width, 180px) ';
    colTemplate += '1fr ';
    if (rightAside) colTemplate += 'var(--lcf-right-sidebar-width, 220px)';

    layoutContainer.style.setProperty('display', 'grid', 'important');
    layoutContainer.style.setProperty('grid-template-columns', colTemplate.trim(), 'important');
    layoutContainer.style.setProperty('gap', 'var(--lcf-gap, 12px)', 'important');
    layoutContainer.style.setProperty('max-width', '100%', 'important');
    layoutContainer.style.setProperty('width', '100%', 'important');
    layoutContainer.style.setProperty('padding-left', 'var(--lcf-gap, 12px)', 'important');
    layoutContainer.style.setProperty('padding-right', 'var(--lcf-gap, 12px)', 'important');
    layoutContainer.style.setProperty('box-sizing', 'border-box', 'important');
    layoutContainer.style.setProperty('align-items', 'start', 'important');

    // Pin & style left sidebar – full height till bottom of page/viewport
    if (leftAside) {
      leftAside.style.setProperty('position', 'sticky', 'important');
      leftAside.style.setProperty('top', '60px', 'important');
      leftAside.style.setProperty('width', 'var(--lcf-left-sidebar-width, 180px)', 'important');
      leftAside.style.setProperty('min-width', 'var(--lcf-left-sidebar-width, 180px)', 'important');
      leftAside.style.setProperty('max-width', 'var(--lcf-left-sidebar-width, 180px)', 'important');
      leftAside.style.setProperty('height', 'var(--lcf-left-sidebar-height, calc(100vh - 70px))', 'important');
      leftAside.style.setProperty('overflow-y', 'auto', 'important');
      leftAside.style.setProperty('overflow-x', 'hidden', 'important');
      leftAside.style.setProperty('scrollbar-width', 'thin', 'important');
    }

    // Pin & style right sidebar
    if (rightAside) {
      rightAside.style.setProperty('position', 'sticky', 'important');
      rightAside.style.setProperty('top', '60px', 'important');
      rightAside.style.setProperty('width', 'var(--lcf-right-sidebar-width, 220px)', 'important');
      rightAside.style.setProperty('min-width', 'var(--lcf-right-sidebar-width, 220px)', 'important');
      rightAside.style.setProperty('max-width', 'var(--lcf-right-sidebar-width, 220px)', 'important');
      rightAside.style.setProperty('height', 'var(--lcf-right-sidebar-height, auto)', 'important');
      rightAside.style.setProperty('overflow-y', 'auto', 'important');
      rightAside.style.setProperty('overflow-x', 'hidden', 'important');
      rightAside.style.setProperty('scrollbar-width', 'thin', 'important');
    }

    // Feed section fills all remaining space
    if (section) {
      section.style.setProperty('min-width', '0', 'important');
      section.style.setProperty('max-width', '100%', 'important');
      section.style.setProperty('width', '100%', 'important');
    }

    log('Grid layout applied. Columns:', colTemplate.trim());

    document.body.classList.add('lcf-active');

    return { leftAside: leftAside, section: section, rightAside: rightAside };
  }

  /* ---- Indicator ---- */

  function showIndicator() {
    var old = document.querySelector('.lcf-indicator');
    if (old) old.remove();

    var el = document.createElement('div');
    el.className = 'lcf-indicator';
    el.textContent = '\u2726 LinkedIn Clean Feed active';
    document.body.appendChild(el);

    setTimeout(function () {
      el.classList.add('lcf-fade-out');
      setTimeout(function () { el.remove(); }, 600);
    }, 3000);
  }

  /* ---- Main init ---- */

  var initRunning = false;

  function init() {
    if (initRunning) return;
    initRunning = true;

    log('init() – checking page...');

    if (!isFeed()) {
      log('Not a feed page. Skipping.');
      initRunning = false;
      return;
    }

    waitFor('main')
      .then(function () {
        log('main element found. Waiting 2s for React render...');
        return new Promise(function (r) { setTimeout(r, 2000); });
      })
      .then(function () {
        var layoutContainer = findLayoutContainer();
        if (!layoutContainer) {
          warn('Layout container not found. Dumping DOM for debug:');
          var m = document.querySelector('main');
          if (m) log('main children:', m.innerHTML.substring(0, 500));
          initRunning = false;
          return;
        }

        var parts = applyLayout(layoutContainer);
        showIndicator();

        function bootMasonry(fl) {
          log('Starting masonry on feed list with', fl.children.length, 'children...');
          var curr = fl;
          while (curr && curr !== parts.section) {
            curr.style.setProperty('width', '100%', 'important');
            curr.style.setProperty('max-width', '100%', 'important');
            curr = curr.parentElement;
          }
          fl.setAttribute('data-lcf-feed-list', '1');

          if (typeof window.__lcfStartMasonry === 'function') {
            window.__lcfStartMasonry(fl);
          } else {
            err('masonry.js not loaded!');
          }
        }

        // Find feed list
        var feedList = findFeedList(parts.section);
        if (feedList) {
          bootMasonry(feedList);
        } else {
          log('Waiting for feed list to populate...');
          var retries = 0;
          var retryInterval = setInterval(function () {
            retries++;
            feedList = findFeedList(parts.section);
            if (feedList) {
              clearInterval(retryInterval);
              bootMasonry(feedList);
            } else if (retries > 15) {
              clearInterval(retryInterval);
              warn('Feed list not found inside section after retries.');
            }
          }, 400);
        }

        initRunning = false;
      })
      .catch(function (e) {
        err('Init failed:', e);
        initRunning = false;
      });
  }

  /* ---- SPA navigation ---- */

  var lastUrl = location.href;

  function watchNav() {
    var obs = new MutationObserver(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        log('Navigation:', lastUrl);

        // Cleanup
        if (typeof window.__lcfCleanupMasonry === 'function') {
          window.__lcfCleanupMasonry();
        }
        document.querySelectorAll('[data-lcf-role]').forEach(function (el) {
          el.removeAttribute('data-lcf-role');
          el.removeAttribute('data-lcf-cols');
          el.removeAttribute('data-lcf-unlock');
        });
        document.body.classList.remove('lcf-active');

        if (isFeed()) {
          setTimeout(init, 2000);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ---- Boot ---- */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 1000);
    });
  } else {
    setTimeout(init, 500);
  }
  watchNav();

})();
