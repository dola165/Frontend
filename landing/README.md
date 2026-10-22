# grasskickz.com landing

The one-screen page in front of grasskickz.com during the private preview. It is a static
site for Cloudflare Pages and is separate from the web app in `frontend/`, which it never imports.

- `src/` — the page (`index.html`; `styles.css` for the whole design: night-green pitch, "We're in
  the warm-up.", six coming-soon cards, the password bar and the construction tape; a tiny
  `landing.js` for the wrong-password note), `_headers` for Pages, icons and the share card.
- `scripts/build.mjs` — copies `src/` to `dist/` and adds the self-hosted font files
  (Archivo variable, upright and italic, and JetBrains Mono) from the pinned `@fontsource` packages, so the
  page makes no requests to other hosts.
- `scripts/render-images.mjs` — renders `assets/share.png` (1200×630), `assets/apple-touch-icon.png`
  and `favicon.ico` with the web app's Playwright (`frontend/node_modules`).

```bash
npm ci
npm run preview   # build and serve dist/ on http://127.0.0.1:4310/
npm run check     # build, then W3C Nu checker on the HTML, CSS and SVGs (needs Java)
npm run images    # re-render the share card and icons after changing the page or the mark
```

Deploy by uploading `dist/` to the Pages project. This page is the private-preview lock: the
Worker in the backend repository shows it at every address on grasskickz.com until the password in
the corner bar is right, then passes everything to the app. The Worker serves the page's own files
under `/__preview/` (so they never collide with the app's paths), which is why every URL in
`index.html` starts with it; a wrong password comes back with `#wrong`, which `landing.js` shows.

The design follows the founders' "warm-up" mock-up (22 Oct 2026). The favicon and touch icon
are still the brand book's G mark.
