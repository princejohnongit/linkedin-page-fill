# LinkedIn Clean Feed – Chrome Extension

> Transform LinkedIn's desktop feed into a cleaner, wider two-column masonry layout with customizable sizes and full-width sidebars.

## What It Does

LinkedIn Clean Feed modifies **only the visual layout** of LinkedIn's desktop feed:

- **Profile sidebar** → pinned to the **extreme left** of the viewport, running full-height
- **LinkedIn News sidebar** → pinned to the **extreme right** of the viewport
- **Feed** → **expanded** to fill all remaining horizontal space (`1fr`)
- **Posts** → displayed in a **two-column masonry layout** (Pinterest-style)
- **Zero Functionality Lost**: likes, comments, reposts, videos, dropdowns, polls, and infinite scrolling work untouched

## Before / After

```
BEFORE (default LinkedIn):
┌─────────────────────────────────────────────────┐
│             ┌───────────────────────┐            │
│   wasted    │  Profile │ Feed │News │   wasted   │
│   space     │          │      │     │   space    │
│             └───────────────────────┘            │
└─────────────────────────────────────────────────┘

AFTER (LinkedIn Clean Feed):
┌─────────────────────────────────────────────────┐
│ Profile │    Post 1    │    Post 2    │   News   │
│         │    Post 3    │    Post 4    │          │
│ (full-  │    Post 5    │    Post 6    │          │
│ height) │    Post 7    │    Post 8    │          │
└─────────────────────────────────────────────────┘
```

## Installation

### Step 1: Open Chrome Extensions
1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).

### Step 2: Load the Extension
1. Click **"Load unpacked"**.
2. Select the `linkedin-clean-feed` folder (or unzip `linkedin-clean-feed.zip` and select it).
3. The extension card **"LinkedIn Clean Feed"** will appear.

### Step 3: Browse LinkedIn
1. Navigate to [linkedin.com/feed/](https://www.linkedin.com/feed/).
2. The extension activates automatically, displaying a brief confirmation indicator.

---

## Customizing Sizes & Layout in `styles.css`

All sizes and dimensions can be customized directly in **`styles.css`** at lines **14–50**:

```css
:root {
  /* === 1. POST & FEED SIZES === */
  --lcf-post-scale: 1.0;             /* Master scale: 0.85 (smaller), 1.0 (normal), 1.2 (larger) */
  --lcf-post-media-max-height: 480px;/* Max height for images/videos in posts */
  --lcf-post-max-width: 100%;        /* Max width of post cards (e.g. 550px or 100%) */
  --lcf-masonry-columns: 2;          /* Number of post columns: 1 (single), 2 (default), 3 (compact) */
  --lcf-masonry-gap: 12px;           /* Space between posts */
  --lcf-post-font-size: inherit;     /* Text font size inside posts */

  /* === 2. SIDEBAR SIZES & DIMENSIONS === */
  --lcf-left-sidebar-width: 180px;   /* Left profile sidebar width */
  --lcf-left-sidebar-height: calc(100vh - 70px); /* Height: full page or 'auto' */
  --lcf-left-sidebar-scale: 0.85;    /* Content scale: 0.8 to 1.0 */

  --lcf-right-sidebar-width: 220px;  /* Right news sidebar width */
  --lcf-right-sidebar-height: auto;  /* Height: 'auto' or 'calc(100vh - 70px)' */
  --lcf-right-sidebar-scale: 0.85;   /* Content scale: 0.8 to 1.0 */

  /* === 3. OVERALL SPACING & MARGINS === */
  --lcf-gap: 12px;                   /* Gap between sidebars and feed */
  --lcf-header-offset: 60px;         /* Top offset below LinkedIn's header */
}
```

### Quick Reference:

| Desired Change | CSS Variable in `styles.css` | Example Value |
|---|---|---|
| Resize post + images together | `--lcf-post-scale` | `0.85` or `1.15` |
| Limit max image height | `--lcf-post-media-max-height` | `350px` or `none` |
| Change number of columns | `--lcf-masonry-columns` | `1`, `2`, or `3` |
| Left sidebar width | `--lcf-left-sidebar-width` | `160px` or `200px` |
| Left sidebar full-page vs short | `--lcf-left-sidebar-height` | `calc(100vh - 70px)` or `auto` |
| Right sidebar width | `--lcf-right-sidebar-width` | `180px` or `240px` |
| Spacing between columns | `--lcf-masonry-gap` | `8px`, `12px`, `16px` |

*After making changes, click the ↻ reload button on `chrome://extensions/` and refresh LinkedIn (`Ctrl + Shift + R`).*

---

## File Structure

| File | Purpose |
|------|---------|
| `manifest.json` | Manifest V3 configuration |
| `styles.css` | Full-width grid overrides, CSS variables, sidebar & masonry styling |
| `masonry.js` | Masonry engine with shortest-column-first distribution |
| `content.js` | Adaptive semantic layout detection, SPA navigation watcher |
| `assets/` | Extension icons (48x48, 128x128) |
| `linkedin-clean-feed.zip` | Pre-packaged ZIP archive for easy distribution |

---

## Architecture & React Compatibility

### Semantic DOM Traversal
LinkedIn uses hashed CSS classes (e.g. `gvylm5`, `gvymal`). Rather than relying on fragile class names, the extension uses semantic HTML tags (`<main>`, `<aside>`, `<section>`) and structural tree heuristics to detect layout elements reliably across LinkedIn updates.

### Shortest-Column-First Masonry
- Posts are distributed into columns based on actual accumulated heights rather than simple alternating.
- Images, videos, and expandable text that alter heights after loading are tracked via `ResizeObserver`.
- Infinite scrolling continuously incorporates new posts via `MutationObserver` without duplicate insertions or loops.

---

## Privacy

This extension:
- Collects **zero** user data
- Makes **no** external network requests
- Uses **no** third-party trackers or analytics
- Operates entirely locally within your browser tab

## License

MIT
