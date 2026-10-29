// Sandbox server: serves sandbox/dist and a synthetic /api. No real data; the only network calls are the page pet's
// questions (pet-guide.mjs), and only when the keys file is there.
// Usage: node sandbox/server.mjs [port]
import http from 'node:http';
import { readFile, stat, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api/router.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const runtime = path.join(here, '.runtime');
await mkdir(runtime, { recursive: true });
const port = Number(process.argv[2] || process.env.SANDBOX_PORT || 4300);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.csv': 'text/csv', '.ico': 'image/x-icon' };

async function readBody(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) { try { return JSON.parse(raw.toString() || 'null'); } catch { return null; } }
  if (type.includes('x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw.toString()));
  return raw.length ? { _raw: raw.length, _type: type } : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/sandbox/pet-guide' && req.method === 'POST') {
      const { petGuide } = await import('./pet-guide.mjs');
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(await petGuide(await readBody(req))));
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : null;
      const result = await handleApi({ method: req.method, path: url.pathname.replace(/^\/api/, '') || '/', query: url.searchParams, body, headers: req.headers });
      if (!result) {
        await appendFile(path.join(runtime, `unhandled-${port}.jsonl`), JSON.stringify({ method: req.method, path: url.pathname, query: url.search, page: req.headers.referer || '' }) + '\n');
        res.writeHead(404, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ status: 404, message: 'Not available in the sandbox yet.' }));
      }
      const headers = { 'content-type': 'application/json', ...(result.headers || {}) };
      res.writeHead(result.status || 200, headers);
      return res.end(result.body === undefined ? '' : (typeof result.body === 'string' ? result.body : JSON.stringify(result.body)));
    }
    if (url.pathname === '/sandbox-map/style.json') {
      const { sandboxMapStyle } = await import('./map-style.mjs');
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(sandboxMapStyle(`http://${req.headers.host}`)));
    }
    // The sandbox style draws no text; an empty glyph range keeps any label layer quiet.
    if (url.pathname.startsWith('/sandbox-map/glyphs/')) { res.writeHead(200, { 'content-type': 'application/x-protobuf' }); return res.end(); }
    if (url.pathname === '/__guide') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(await readFile(path.join(here, 'guide.html')));
    }
    if (url.pathname === '/__mode/nodob' || url.pathname === '/__mode/coach') {
      // An account without a birth date (the profile asks for it once); the owner persona gives it back.
      const { accountProfile } = await import('./api/world-social.mjs');
      accountProfile.dob = url.pathname === '/__mode/nodob' ? null : accountProfile.dob ?? '1988-04-12';
      if (url.pathname === '/__mode/nodob') { res.writeHead(302, { location: url.searchParams.get('to') || '/profile/1', 'cache-control': 'no-store' }); return res.end(); }
    }
    if (/^\/__mode\/(parent|coach|analyst|member|headcoach|physio|attendance|teammanager|gkcoach|headofcoaching|kit|helper)$/.test(url.pathname)) {
      // Sandbox personas, all still Luka's account: `parent` makes him also a parent of two children (the family cookie);
      // `analyst` gives him a performance analyst's club access (a few tools, two of them read-only), `member` plain
      // club membership with no tools at all, `headcoach` a head coach who is not an admin and `physio` a job with only
      // the medical tools and `attendance` a Custom job with only Attendance, so Club office's layers can be judged;
      // `coach` is the owner and head coach again. My squads, step 3: `teammanager`, `gkcoach` (goalkeeper coach),
      // `headofcoaching`, `kit` (equipment manager) and `helper` (no job; one session on Home), see world-my-squads.mjs.
      const mode = url.pathname.slice('/__mode/'.length);
      const to = (url.searchParams.get('to') || '/home');
      const safe = to.startsWith('/') && !to.startsWith('//') ? to : '/home';
      const cookies = [
        mode === 'parent' ? 'gk-sandbox-family=1; Path=/' : 'gk-sandbox-family=; Path=/; Max-Age=0',
        ['analyst', 'member', 'headcoach', 'physio', 'attendance', 'teammanager', 'gkcoach', 'headofcoaching', 'kit', 'helper'].includes(mode) ? `gk-sandbox-persona=${mode}; Path=/` : 'gk-sandbox-persona=; Path=/; Max-Age=0',
      ];
      res.writeHead(302, { location: safe, 'set-cookie': cookies, 'cache-control': 'no-store' });
      return res.end();
    }
    if (url.pathname.startsWith('/sandbox-overpass')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"elements":[]}'); }
    if (url.pathname.startsWith('/sandbox-media/')) {
      const { mediaSvg } = await import('./api/media.mjs');
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=3600' }); return res.end(await mediaSvg(url.pathname));
    }
    if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/media/')) {
      res.writeHead(302, { location: '/sandbox-media/photo/' + encodeURIComponent(url.pathname) + '.svg' }); return res.end();
    }
    let file = path.join(dist, decodeURIComponent(url.pathname));
    if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
    let info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) { file = path.join(dist, 'index.html'); info = await stat(file); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch (error) {
    console.error('sandbox server error', req.method, req.url, error);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 500, message: String(error?.message || error) }));
  }
});
server.on('upgrade', (req, socket) => socket.destroy());
server.listen(port, () => console.log(`GrassKickZ sandbox on http://localhost:${port}\nTest guide: http://localhost:${port}/__guide\nStop with Ctrl+C. Restarting resets all data.`));
