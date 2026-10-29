// Tiny router for the synthetic API. Handlers register (method, pattern, fn).
// A handler returns plain data (=> 200 JSON) or { status, body, headers }.
const routes = [];
export function route(method, pattern, fn) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/\/:([A-Za-z0-9_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  routes.push({ method, regex, keys, fn, pattern });
}
export const get = (p, fn) => route('GET', p, fn);
export const post = (p, fn) => route('POST', p, fn);
export const put = (p, fn) => route('PUT', p, fn);
export const patch = (p, fn) => route('PATCH', p, fn);
export const del = (p, fn) => route('DELETE', p, fn);
/** Registers a route ahead of every other: a sandbox persona answered before the shared handlers. */
export const first = (method, pattern, fn) => { route(method, pattern, fn); routes.unshift(routes.pop()); };
export const reply = (status, body, headers) => ({ __reply: true, status, body, headers });

let loaded;
async function load() {
  if (!loaded) loaded = import('./handlers/index.mjs');
  return loaded;
}

export async function handleApi(req) {
  await load();
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = req.path.match(r.regex);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const result = await r.fn({ ...req, params });
    if (result === undefined) continue; // handler declined; try the next match
    if (result && result.__reply) return { status: result.status, body: result.body, headers: result.headers };
    return { status: req.method === 'POST' && result && result.__created ? 201 : 200, body: result };
  }
  return null;
}
export const listRoutes = () => routes.map(r => `${r.method} ${r.pattern}`);
