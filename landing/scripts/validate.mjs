// Checks the built page, its stylesheet and SVGs with the W3C Nu HTML Checker (vnu-jar, needs Java).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const vnu = String(createRequire(import.meta.url)('vnu-jar'));
const dist = (file) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));
const files = ['index.html', 'styles.css', 'kick.css', 'hub.css', 'assets/grasskickz-lockup.svg', 'assets/favicon.svg'].map(dist);

try {
  execFileSync('java', ['-jar', vnu, '--also-check-css', '--also-check-svg', '--verbose', ...files], { stdio: 'inherit' });
  console.log('HTML, CSS and SVG are valid.');
} catch (error) {
  process.exitCode = error.status ?? 1;
}
