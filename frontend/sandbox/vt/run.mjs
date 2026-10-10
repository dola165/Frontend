// Runs vitest-style test files where vitest cannot start (its rollup native binary is missing here).
// Each file is bundled with esbuild; vi.mock factories register in place and a mocked module calls its factory on
// first use; tests run in jsdom with @vitest/expect and jest-dom matchers. A check, not a replacement for vitest.
// Usage (from frontend/): node sandbox/vt/run.mjs <test file>... [--filter=text]
import path from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, '../..');
const rest = process.argv.slice(2);
const files = rest.filter(arg => !arg.startsWith('--'));
const filter = rest.find(arg => arg.startsWith('--filter='))?.slice(9);
const esbuild = (await import(pathToFileURL('/opt/npm-tools/node_modules/esbuild/lib/main.js').href)).default;
const { JSDOM } = await import(pathToFileURL(path.join(frontend, 'node_modules/jsdom/lib/api.js')).href);

// jsdom globals, as vitest's jsdom environment provides them.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost:3000/', pretendToBeVisual: true });
const win = dom.window;
for (const key of Object.getOwnPropertyNames(win)) {
  if (key in globalThis && !['Event', 'CustomEvent', 'EventTarget', 'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'UIEvent', 'InputEvent', 'StorageEvent', 'Node', 'Element', 'HTMLElement', 'DocumentFragment', 'FormData', 'Blob', 'File', 'URL', 'URLSearchParams'].includes(key)) continue;
  try { Object.defineProperty(globalThis, key, { value: win[key], configurable: true, writable: true }); } catch { /* read-only */ }
}
for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location', 'history']) Object.defineProperty(globalThis, key, { value: key === 'window' ? win : win[key], configurable: true, writable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
win.HTMLElement.prototype.scrollIntoView = function () {};
win.Element.prototype.scrollTo = function () {};

/** Finds the end of a call that starts at `start` (the index of its opening parenthesis). */
function closeParen(text, start) {
  let depth = 0, quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i; }
  }
  throw new Error('unbalanced');
}

async function bundle(testFile) {
  const source = await readFile(testFile, 'utf8');
  // vi.mock factories stay where they are and register themselves; the mocked module calls its factory on first
  // use, by which time the test module (and anything a factory closes over) has run. vi.hoisted runs in place.
  const mocks = [];
  let body = source;
  for (let from = 0; ;) {
    const match = /^vi\.mock\((['"])([^'"]+)\1/m.exec(body.slice(from));
    if (!match) break;
    const index = from + match.index;
    const end = closeParen(body, index + 'vi.mock'.length);
    mocks.push(match[2]);
    const call = body.slice(index, end + 1);
    const replaced = call.replace(/^vi\.mock\((['"])([^'"]+)\1\s*,\s*/, (_, q, spec) => `globalThis.__vtMocks[${JSON.stringify(spec)}] = (`);
    body = body.slice(0, index) + replaced + body.slice(end + 1);
    from = index + replaced.length;
  }
  const dir = path.dirname(testFile);
  const resolved = new Map();
  const testBody = `globalThis.__vtMocks ??= {};\n${body}`;
  const exportsOf = async file => {
    const result = await esbuild.build({ entryPoints: [file], write: false, metafile: true, bundle: false, format: 'esm', outdir: path.join(frontend, 'sandbox/.runtime/vt/exports'), jsx: 'automatic', logLevel: 'silent' });
    return Object.values(result.metafile.outputs).find(output => output.entryPoint)?.exports ?? [];
  };
  const plugin = {
    name: 'vt',
    setup(build) {
      build.onResolve({ filter: /^vitest$/ }, () => ({ path: path.join(here, 'vitest-shim.mjs') }));
      build.onResolve({ filter: /^vt:entry$/ }, () => ({ path: 'entry', namespace: 'vt' }));
      build.onResolve({ filter: /^vt:test$/ }, () => ({ path: testFile, namespace: 'vt-test' }));
      build.onLoad({ filter: /.*/, namespace: 'vt' }, () => ({ contents: `import 'vitest';\nimport 'vt:test';\nexport { run } from 'vitest';`, loader: 'js', resolveDir: dir }));
      build.onLoad({ filter: /.*/, namespace: 'vt-test' }, () => ({ contents: testBody, loader: testFile.endsWith('x') ? 'tsx' : 'ts', resolveDir: dir }));
      build.onResolve({ filter: /.*/ }, async args => {
        if (args.pluginData?.vt || args.namespace === 'vt-mock') return undefined;
        const result = await build.resolve(args.path, { resolveDir: args.resolveDir, kind: args.kind, importer: args.importer, pluginData: { vt: true } });
        if (result.errors.length) return undefined;
        if (!resolved.size) for (const spec of mocks) {
          const r = await build.resolve(spec, { resolveDir: dir, kind: 'import-statement', pluginData: { vt: true } });
          if (!r.errors.length) resolved.set(r.path, spec);
        }
        const spec = resolved.get(result.path);
        if (spec) return { path: result.path, namespace: 'vt-mock', pluginData: { spec } };
        return { path: result.path, external: result.external };
      });
      build.onLoad({ filter: /.*/, namespace: 'vt-mock' }, async args => {
        const names = await exportsOf(args.path);
        const spec = JSON.stringify(args.pluginData.spec);
        return { loader: 'js', contents: `
          const names = ${JSON.stringify(names)};
          const value = () => { const factory = globalThis.__vtMocks[${spec}]; if (!factory) throw new Error('No mock factory for ' + ${spec}); if (!('v' in factory)) factory.v = factory(); return factory.v; };
          module.exports = new Proxy({}, {
            ownKeys: () => names,
            getOwnPropertyDescriptor: (_, key) => names.includes(key) ? { configurable: true, enumerable: true, get: () => value()[key] } : undefined,
            get: (_, key) => key === '__esModule' ? true : value()[key],
            has: (_, key) => names.includes(key),
          });` };
      });
    },
  };
  const result = await esbuild.build({
    entryPoints: ['vt:entry'], bundle: true, write: false, format: 'esm', platform: 'node', target: 'node20',
    absWorkingDir: frontend, nodePaths: [path.join(frontend, 'node_modules')], jsx: 'automatic', logLevel: 'error',
    loader: { '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.woff2': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ DEV: true, PROD: false, MODE: 'test', BASE_URL: '/', VITE_API_BASE_URL: '/api' }) },
    mainFields: ['module', 'main'], conditions: ['browser', 'import', 'default'],
    banner: { js: "import { createRequire as __vtRequire } from 'node:module'; const require = __vtRequire(import.meta.url);" },
    plugins: [plugin],
  });
  return result.outputFiles[0].text;
}

let failed = 0;
for (const file of files) {
  const absolute = path.resolve(frontend, file);
  const code = await bundle(absolute);
  const out = path.join(frontend, 'sandbox/.runtime/vt', path.basename(absolute) + '.mjs');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, code);
  localStorage.clear();
  const module = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
  const results = await module.run(filter);
  console.log(`\n${file}`);
  for (const r of results) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}`);
    if (!r.ok) { failed++; console.log(r.error.replace(/^/gm, '        ')); }
  }
}
console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
