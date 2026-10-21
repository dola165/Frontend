// Builds landing/dist: the page from src/ plus the two self-hosted font files
// (and their licences) from the pinned @fontsource packages. Upload dist/ as is.
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);

const FONTS = [
  ['@fontsource/unbounded', 'unbounded-latin-800-normal.woff2', 'Unbounded-OFL.txt'],
  ['@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-500-normal.woff2', 'BricolageGrotesque-OFL.txt'],
];

await rm(dist, { recursive: true, force: true });
await cp(new URL('src/', root), dist, { recursive: true });
await mkdir(new URL('fonts/', dist));

for (const [pkg, file, licence] of FONTS) {
  const source = new URL(`node_modules/${pkg}/`, root);
  await copyFile(new URL(`files/${file}`, source), new URL(`fonts/${file}`, dist));
  await copyFile(new URL('LICENSE', source), new URL(`fonts/${licence}`, dist));
}

console.log(`Built ${dist.pathname}`);
