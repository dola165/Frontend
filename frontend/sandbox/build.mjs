// Sandbox build: bundles the app with esbuild + Tailwind's JS compiler.
// Used only where Vite's native binaries are unavailable. Output: sandbox/dist
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'src');
const out = path.join(here, 'dist');
const ESBUILD = process.env.SANDBOX_ESBUILD || '/opt/npm-tools/node_modules/esbuild/lib/main.js';
const esbuild = (await import(pathToFileURL(ESBUILD).href)).default ?? await import(pathToFileURL(ESBUILD).href);
const { compile } = await import(pathToFileURL(path.join(root, 'node_modules/tailwindcss/dist/lib.mjs')).href);

async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', '__tests__', 'mocks'].includes(entry.name)) await walk(p, acc); }
    else if (/\.(tsx?|jsx?|html|css)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

async function candidates() {
  const set = new Set();
  for (const file of await walk(src)) {
    const text = await readFile(file, 'utf8');
    for (const token of text.split(/[\s"'`{}();,<>]+/)) {
      if (token.length > 0 && token.length < 120 && /^[!\-a-z0-9@\[(]/i.test(token)) set.add(token.replace(/^\$\{?/, ''));
    }
  }
  return [...set];
}

async function tailwindCss(file) {
  const css = await readFile(file, 'utf8');
  const loadStylesheet = async (id, base) => {
    let resolved;
    if (id === 'tailwindcss') resolved = path.join(root, 'node_modules/tailwindcss/index.css');
    else if (id.startsWith('tailwindcss/')) resolved = path.join(root, 'node_modules', id.endsWith('.css') ? id : id + '.css');
    else resolved = path.resolve(base, id);
    return { path: resolved, base: path.dirname(resolved), content: await readFile(resolved, 'utf8') };
  };
  const compiler = await compile(css.replace(/@import url\([^)]*\);?/g, ''), { base: path.dirname(file), loadStylesheet, loadModule: async () => { throw new Error('plugins unsupported'); } });
  return compiler.build(await candidates());
}

const env = {
  DEV: false, PROD: true, MODE: 'sandbox', BASE_URL: '/',
  VITE_API_BASE_URL: '/api', VITE_ENABLE_MOCKS: 'false', VITE_GOOGLE_CLIENT_ID: 'sandbox-google-client',
  VITE_OVERPASS_URL: '/sandbox-overpass', VITE_PAYMENT_PREVIEW: 'true',
};

const sandboxPlugin = {
  name: 'sandbox',
  setup(build) {
    build.onResolve({ filter: /^@\// }, args => ({ path: path.join(src, args.path.slice(2)) }));
    build.onResolve({ filter: /\?worker&inline$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.replace(/\?.*$/, '')), namespace: 'inline-worker' }));
    build.onLoad({ filter: /.*/, namespace: 'inline-worker' }, async args => {
      let file = args.path; for (const ext of ['.ts', '.js']) if (!existsSync(file) && existsSync(file + ext)) file += ext;
      const result = await esbuild.build({ entryPoints: [file], bundle: true, write: false, format: 'iife', minify: true, plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^@\// }, a => ({ path: path.join(src, a.path.slice(2)) })); } }] });
      const code = result.outputFiles[0].text;
      return { contents: `const code = ${JSON.stringify(code)}; export default class InlineWorker { constructor() { return new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))); } }`, loader: 'js' };
    });
    build.onResolve({ filter: /\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    build.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({ contents: `export default ${JSON.stringify(await readFile(args.path, 'utf8'))};`, loader: 'js' }));
    build.onLoad({ filter: /src[\\/]index\.css$/ }, async args => ({ contents: await tailwindCss(args.path), loader: 'css', resolveDir: path.dirname(args.path) }));
    // Mirror Vite: a component's CSS is applied when its module loads (lazy routes included).
    build.onLoad({ filter: /\.css$/ }, async args => {
      if (/src[\\/]index\.css$/.test(args.path)) return undefined;
      const nested = await esbuild.build({ entryPoints: [args.path], bundle: true, write: false, outdir: path.join(out, 'assets'), assetNames: '[name]-[hash]', publicPath: '/assets/', logLevel: 'error',
        loader: { '.svg': 'file', '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.webp': 'file', '.woff2': 'file', '.woff': 'file' } });
      let css = '';
      for (const file of nested.outputFiles) {
        if (file.path.endsWith('.css')) css += file.text;
        else { await mkdir(path.dirname(file.path), { recursive: true }); await writeFile(file.path, file.contents); }
      }
      const key = path.relative(root, args.path).replace(/\\/g, '/');
      return { loader: 'js', contents: `const key = ${JSON.stringify(key)}; if (!document.querySelector('style[data-sandbox-css="' + key + '"]')) { const el = document.createElement('style'); el.dataset.sandboxCss = key; el.textContent = ${JSON.stringify(css)}; document.head.appendChild(el); }` };
    });
  },
};

export async function buildSandbox({ quiet = false } = {}) {
  const started = Date.now();
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const define = { 'import.meta.env': JSON.stringify(env) };
  for (const [k, v] of Object.entries(env)) define[`import.meta.env.${k}`] = JSON.stringify(v);
  const result = await esbuild.build({
    entryPoints: [path.join(src, 'main.tsx')], bundle: true, splitting: true, format: 'esm', outdir: path.join(out, 'assets'),
    entryNames: '[name]', chunkNames: 'chunk-[hash]', assetNames: '[name]-[hash]', jsx: 'automatic', target: 'es2022', sourcemap: false,
    define, plugins: [sandboxPlugin], logLevel: quiet ? 'error' : 'warning', metafile: true,
    loader: { '.svg': 'file', '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.webp': 'file', '.woff2': 'file', '.woff': 'file', '.csv': 'text', '.json': 'json', '.mp4': 'file' },
    publicPath: '/assets/',
  });
  if (existsSync(path.join(root, 'public'))) await cp(path.join(root, 'public'), out, { recursive: true });
  const html = (await readFile(path.join(root, 'index.html'), 'utf8'))
    .replace('<script type="module" src="/src/main.tsx"></script>', '<link rel="stylesheet" href="/assets/main.css"><script type="module" src="/assets/main.js"></script>');
  await writeFile(path.join(out, 'index.html'), html);
  if (!quiet) console.log(`sandbox build ok in ${Date.now() - started}ms, ${result.errors.length} errors, ${result.warnings.length} warnings`);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await buildSandbox().catch(error => { console.error(error.message ?? error); process.exit(1); });
}
