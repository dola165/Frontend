// Serves landing/dist locally the way the lock Worker and Cloudflare Pages will: the
// page's files live under /__preview/, unknown paths fall back to index.html, and the
// rules in _headers are applied.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

function parseHeaders(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: [] });
    else rules.at(-1)?.headers.push(line.trim().split(/:\s*(.*)/s).slice(0, 2));
  }
  return rules;
}

const matches = (pattern, path) => pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern;

export async function startServer(port = 0) {
  const rules = parseHeaders(await readFile(dist + '_headers', 'utf8'));
  const server = createServer(async (request, response) => {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = requested.startsWith('/__preview/') ? requested.slice('/__preview'.length) : requested;
    let file = path.endsWith('/') ? path + 'index.html' : path;
    let body;
    try {
      if (file.includes('..') || file.split('/').some((part) => part.startsWith('_'))) throw new Error('hidden');
      body = await readFile(dist + file.slice(1));
    } catch {
      file = '/index.html';
      body = await readFile(dist + 'index.html');
    }
    for (const rule of rules) {
      if (matches(rule.pattern, path)) for (const [name, value] of rule.headers) response.setHeader(name, value);
    }
    response.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    response.end(request.method === 'HEAD' ? undefined : body);
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.PORT ?? 4310));
  console.log(`Landing preview on http://127.0.0.1:${server.address().port}/`);
}
