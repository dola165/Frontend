import { readFile, writeFile, mkdir } from 'node:fs/promises';
const cases = [['commerce-drafts-smoke', 'commerce-r1'], ['jobs-revision-smoke', 'commerce-r2'], ['store-archive-revision-smoke', 'commerce-r3'], ['commerce-r4-smoke', 'commerce-r4'], ['commerce-r5-smoke', 'commerce-r5']];
await mkdir('review/full-web-20260910', { recursive: true });
for (const [name, output] of cases) {
  const source = await readFile(`e2e/${name}.mjs`, 'utf8');
  await writeFile(`review/full-web-20260910/${name}.mjs`, source.replaceAll(`review/${output}`, `review/full-web-20260910/${output}`));
}
