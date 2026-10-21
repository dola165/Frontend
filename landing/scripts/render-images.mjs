// Renders the share card and icons into src/ with the web app's Playwright:
//   assets/share.png             1200×630 Open Graph / Twitter card of the page
//   assets/apple-touch-icon.png  180×180, full-bleed tile (iOS rounds the corners)
//   favicon.ico                  16, 32 and 48 px from assets/favicon.svg
// Run `npm run build` first; run this again whenever the page or mark changes.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium } = require('playwright');
const src = new URL('../src/', import.meta.url);

const MARK = `<path d="M75.456 24.544A36 36 0 1 0 86 50M50 50H86" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round"/>
<circle cx="50" cy="50" r="8.5" fill="#C8F135" stroke="#FFFFFF" stroke-width="3"/>
<circle cx="75.456" cy="24.544" r="7" fill="#C8F135" stroke="#FFFFFF" stroke-width="3"/>`;
const TILE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
<rect width="100" height="100" fill="#0E1B33"/><g transform="translate(16 16) scale(.68)">${MARK}</g></svg>`;

// An .ico file whose entries are plain PNGs (supported by every current browser).
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map(({ data }) => data)]);
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const share = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce', bypassCSP: true });
  await share.goto(`http://127.0.0.1:${server.address().port}/`);
  await share.evaluate(() => document.fonts.ready);
  await share.addStyleTag({ content: '.open-app { display: none !important; }' });
  await writeFile(new URL('assets/share.png', src), await share.screenshot({ type: 'png' }));

  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await icon.setContent(`<body style="margin:0">${TILE}</body>`);
  await writeFile(new URL('assets/apple-touch-icon.png', src), await icon.screenshot({ type: 'png' }));

  const favicon = await readFile(new URL('assets/favicon.svg', src), 'utf8');
  const pngs = [];
  for (const size of [16, 32, 48]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<body style="margin:0;background:transparent">${favicon.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</body>`);
    pngs.push({ size, data: await page.screenshot({ type: 'png', omitBackground: true }) });
  }
  await writeFile(new URL('favicon.ico', src), ico(pngs));
  console.log('Rendered share.png, apple-touch-icon.png and favicon.ico');
} finally {
  await browser.close();
  server.close();
}
