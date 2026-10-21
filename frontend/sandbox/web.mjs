// Starts the real Vite dev server on the sandbox's synthetic API, on ports of your choosing, so two sessions
// can run the sandbox side by side. Usage: node sandbox/web.mjs [apiPort=4301] [webPort=5174]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [apiPort = '4301', webPort = '5174'] = process.argv.slice(2);
const vite = spawn(process.execPath, [path.join(here, '..', 'node_modules', 'vite', 'bin', 'vite.js'), '--config', path.join(here, '..', 'vite.sandbox.config.ts'), '--port', webPort], {
  stdio: 'inherit',
  env: { ...process.env, SANDBOX_PORT: apiPort },
});
vite.on('exit', code => process.exit(code ?? 0));
