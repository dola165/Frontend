# grasskickz.com landing

The one-screen page served at grasskickz.com while Grasskickz is in private preview. It is a static
site for Cloudflare Pages and is separate from the web app in `frontend/`, which it never imports.

- `src/` — the page (`index.html`; `styles.css` for the page, layout and password, `kick.css` for the
  kick-off line and ball, `network.css` for the picture of what Grasskickz connects; a small
  `landing.js`), `_headers` for Pages, icons and the share card.
- `scripts/build.mjs` — copies `src/` to `dist/` and adds the two self-hosted font files
  (Unbounded ExtraBold, Bricolage Grotesque Medium) from the pinned `@fontsource` packages, so the
  page makes no requests to other hosts.
- `scripts/render-images.mjs` — renders `assets/share.png` (1200×630), `assets/apple-touch-icon.png`
  and `favicon.ico` with the web app's Playwright (`frontend/node_modules`).

```bash
npm ci
npm run preview   # build and serve dist/ on http://127.0.0.1:4310/
npm run check     # build, then W3C Nu checker on the HTML, CSS and SVGs (needs Java)
npm run images    # re-render the share card and icons after changing the page or the mark
```

Deploy by uploading `dist/` to the Pages project. The password form posts to the preview gate on
app.grasskickz.com, which sends a wrong password back to `/?wrong=1`.

The lockup (`assets/grasskickz-lockup.svg`) is the master artwork from the Grasskickz brand book
(Concept F v2, primary dark lockup), taken from the book's vector paths, not redrawn. Replace it if
the founders supply master SVG files. Colours and type follow the same book.
