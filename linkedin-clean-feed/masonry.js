/**
 * LinkedIn Clean Feed – Masonry Engine
 * ====================================
 * Implements two independent masonry columns with shortest-column-first
 * distribution, matching Section 4 of the architectural specification:
 *
 *   - Creates independent columns inside the expanded feed.
 *   - Each column independently stacks posts vertically via Flexbox.
 *   - Distributes posts to the column with smaller accumulated height.
 *   - Handles infinite scrolling via MutationObserver.
 *   - Handles image/video loading via ResizeObserver.
 */

(function () {
  'use strict';

  if (window.__lcfMasonryLoaded) return;
  window.__lcfMasonryLoaded = true;

  var P = '[LCF:Masonry]';
  var log  = function () { var a = Array.prototype.slice.call(arguments); a.unshift(P); console.log.apply(console, a); };
  var warn = function () { var a = Array.prototype.slice.call(arguments); a.unshift(P); console.warn.apply(console, a); };

  var PROCESSED = 'data-lcf-processed';

  // State
  var masonryContainer = null;
  var columns = [];
  var columnHeights = [];
  var postCount = 0;
  var feedListEl = null;
  var mutObs = null;
  var resObs = null;
  var processing = false;

  /* ---- Read user configuration from CSS variables ---- */

  function getColumnCount() {
    try {
      var raw = getComputedStyle(document.documentElement).getPropertyValue('--lcf-masonry-columns');
      var n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 1 && n <= 4) return n;
    } catch (e) {}
    return 2;
  }

  /* ---- Create the Masonry Container & Columns ---- */

  function createMasonryContainer() {
    masonryContainer = document.createElement('div');
    masonryContainer.className = 'lcf-masonry-container';
    masonryContainer.setAttribute('data-lcf-masonry', '1');

    var numCols = getColumnCount();
    columns = [];
    columnHeights = [];

    for (var i = 0; i < numCols; i++) {
      var col = document.createElement('div');
      col.className = 'lcf-masonry-col';
      col.setAttribute('data-lcf-col', String(i + 1));
      masonryContainer.appendChild(col);
      columns.push(col);
      columnHeights.push(0);
    }

    log('Created masonry container with', numCols, 'columns.');
    return masonryContainer;
  }

  /* ---- Collect unprocessed posts from feed list ---- */

  function getUnprocessedPosts() {
    if (!feedListEl) return [];
    var posts = [];
    var children = feedListEl.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      // Skip our own masonry container
      if (child.hasAttribute('data-lcf-masonry')) continue;
      // Skip already processed posts
      if (child.hasAttribute(PROCESSED)) continue;
      // Skip empty sentinels
      if (child.offsetHeight < 10 && child.children.length === 0) continue;
      posts.push(child);
    }
    return posts;
  }

  /* ---- Place a single post into the shortest column ---- */

  function placePost(post) {
    if (!post || post.hasAttribute(PROCESSED)) return;
    post.setAttribute(PROCESSED, '1');
    postCount++;

    // Find the column with the minimum accumulated height
    var shortest = 0;
    var minH = columnHeights[0] || 0;
    for (var i = 1; i < columnHeights.length; i++) {
      if (columnHeights[i] < minH) {
        minH = columnHeights[i];
        shortest = i;
      }
    }

    // Append post to shortest column
    columns[shortest].appendChild(post);

    // Estimate height
    var h = post.offsetHeight || 300;
    columnHeights[shortest] += h;
  }

  /* ---- Distribute a batch of posts ---- */

  function distributePosts(posts) {
    if (processing || !posts || posts.length === 0) return;
    processing = true;

    log('Distributing', posts.length, 'posts...');

    // Temporarily disconnect observer to avoid reacting to our own appends
    if (mutObs) mutObs.disconnect();

    var idx = 0;
    var batchSize = 6;

    function processBatch() {
      var end = Math.min(idx + batchSize, posts.length);
      for (; idx < end; idx++) {
        placePost(posts[idx]);
      }

      updateHeights();

      if (idx < posts.length) {
        requestAnimationFrame(processBatch);
      } else {
        processing = false;
        var summary = columnHeights.map(function(h, i) { return 'Col' + (i+1) + ': ' + Math.round(h) + 'px'; }).join(' | ');
        log('Distribution complete. Total posts:', postCount, '(' + summary + ')');
        startMutationObserver();
      }
    }

    processBatch();
  }

  /* ---- Height Tracking ---- */

  function updateHeights() {
    for (var i = 0; i < columns.length; i++) {
      if (columns[i] && columns[i].scrollHeight > 0) {
        columnHeights[i] = columns[i].scrollHeight;
      }
    }
  }

  /* ---- ResizeObserver: update column heights as images/videos load ---- */

  function startResizeObserver() {
    if (resObs) resObs.disconnect();
    resObs = new ResizeObserver(function () {
      requestAnimationFrame(updateHeights);
    });
    for (var i = 0; i < columns.length; i++) {
      resObs.observe(columns[i]);
    }
  }

  /* ---- MutationObserver: detect infinite scroll posts ---- */

  function startMutationObserver() {
    if (!feedListEl) return;
    if (mutObs) mutObs.disconnect();

    mutObs = new MutationObserver(function (mutations) {
      if (processing) return;

      var hasNew = false;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType === 1 &&
              !node.hasAttribute(PROCESSED) &&
              !node.hasAttribute('data-lcf-masonry')) {
            hasNew = true;
            break;
          }
        }
        if (hasNew) break;
      }

      if (hasNew) {
        setTimeout(function () {
          var newPosts = getUnprocessedPosts();
          if (newPosts.length > 0) {
            distributePosts(newPosts);
          }
        }, 300);
      }
    });

    mutObs.observe(feedListEl, { childList: true });
    log('MutationObserver watching feed list for infinite scroll.');
  }

  /* ---- Public API ---- */

  function startMasonry(feedList) {
    feedListEl = feedList;
    log('Initializing masonry on feed list with', feedList.children.length, 'children.');

    // Create the masonry container & columns
    createMasonryContainer();

    // Collect initial posts before inserting container
    var initialPosts = getUnprocessedPosts();
    log('Found', initialPosts.length, 'initial posts to distribute.');

    // Insert masonry container at top of feed list
    if (feedList.firstChild) {
      feedList.insertBefore(masonryContainer, feedList.firstChild);
    } else {
      feedList.appendChild(masonryContainer);
    }

    // Distribute initial posts
    distributePosts(initialPosts);

    // Start observers
    startResizeObserver();

    // Viewport resize handler
    window.addEventListener('resize', function () {
      requestAnimationFrame(updateHeights);
    });

    log('Masonry engine running.');
  }

  function cleanupMasonry() {
    log('Cleaning up masonry...');

    if (mutObs) { mutObs.disconnect(); mutObs = null; }
    if (resObs) { resObs.disconnect(); resObs = null; }

    if (feedListEl && columns.length > 0) {
      var allPosts = [];
      var maxLen = 0;
      var kids = columns.map(function(c) {
        var arr = Array.prototype.slice.call(c.children);
        if (arr.length > maxLen) maxLen = arr.length;
        return arr;
      });

      for (var r = 0; r < maxLen; r++) {
        for (var c = 0; c < kids.length; c++) {
          if (r < kids[c].length) allPosts.push(kids[c][r]);
        }
      }

      allPosts.forEach(function (post) {
        post.removeAttribute(PROCESSED);
        feedListEl.appendChild(post);
      });

      if (masonryContainer && masonryContainer.parentNode) {
        masonryContainer.remove();
      }
    }

    masonryContainer = null;
    columns = [];
    columnHeights = [];
    postCount = 0;
    feedListEl = null;
    processing = false;

    log('Cleanup complete.');
  }

  window.__lcfStartMasonry   = startMasonry;
  window.__lcfCleanupMasonry = cleanupMasonry;

  log('Masonry engine loaded.');
})();
