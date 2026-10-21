# grasskickz.com landing

The one-screen page at grasskickz.com, behind the private-preview lock screen. It is a static
site for Cloudflare Pages and is separate from the web app in `frontend/`, which it never imports.

- `src/` — the page (`index.html`; `styles.css` for the page, layout and the corner link,
  `kick.css` for the kick-off line and ball, `network.css` for the picture of what Grasskickz
  connects; no JavaScript), `_headers` for Pages, icons, the share card and `lock/photo.jpg`.
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

Deploy by uploading `dist/` to the Pages project. The page sits behind the lock screen: a
Cloudflare Worker on grasskickz.com shows one photo and a password field to everyone without the
pass, and fetches this page from the Pages project for those who have it. `lock/photo.jpg` is
that photo (the web app's `after-the-whistle.jpg`, see `frontend/public/landing/ASSET-NOTES.md`);
the Worker serves it on the lock screen. The corner link opens the app.

The lockup (`assets/grasskickz-lockup.svg`) is the master artwork from the Grasskickz brand book
(Concept F v2, primary dark lockup), taken from the book's vector paths, not redrawn. Replace it if
the founders supply master SVG files. Colours and type follow the same book.
