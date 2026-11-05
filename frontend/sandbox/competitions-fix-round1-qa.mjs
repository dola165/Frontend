// Offline synthetic UI evidence only, including round-2 exact Requests links. DB journeys stay gated.
// Start sandbox/server.mjs 4328 and sandbox/web.mjs 4328 5198 first.
// CHROMIUM=<installed Edge> node sandbox/competitions-fix-round1-qa.mjs <private-evidence-directory>
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tournamentById, tournamentDetail } from './api/world-football.mjs';

const output = process.argv[2], base = process.argv[3] || 'http://localhost:5198';
if (!output || !path.isAbsolute(output) || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Supply private absolute evidence path and local synthetic URL.');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const report = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [1920, 390]) {
    const detail = structuredClone(tournamentDetail(tournamentById(301)));
    detail.status = 'ACTIVE';
    const fixture = detail.fixtures.find(f => f.status === 'COMPLETED');
    // Synthetic season has finished playing; only its recorded concern decisions remain.
    for (const other of detail.fixtures) {
      other.status = 'COMPLETED'; other.homeScore ??= 1; other.awayScore ??= 0;
      other.winnerEntryId = other.homeScore === other.awayScore ? null : other.homeScore > other.awayScore ? other.homeEntryId : other.awayEntryId;
    }
    const fixtureIds = detail.fixtures.map(f => f.id);
    let revision = 3, resultRevision = 1, paused = false, repaired = false;
    const cases = [], contexts = [], entry = { theme, width, captures: [], commands: [], failures: [], externalBlocked: 0 };
    report.push(entry);
    const concernState = role => ({ revision, resultRevision, canRaise: role === 'participant' && detail.status === 'ACTIVE', canReview: role === 'operator' && detail.status === 'ACTIVE', entries: role === 'participant' ? [{ id: fixture.homeEntryId, label: fixture.homeLabel }] : [], concerns: cases });
    async function contextFor(role) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1080 }, locale: 'en-GB', timezoneId: 'Asia/Tbilisi', colorScheme: theme });
      contexts.push(context);
      await context.addInitScript(({ theme, role }) => {
        localStorage.setItem('theme-preference', theme); localStorage.setItem('i18nextLng', 'en');
        const b64 = value => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
        const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: role === 'operator' ? '1' : '21', exp: 4102444800 })}.sandbox`;
        localStorage.setItem('gk-session-id', `competitions-${role}`);
        localStorage.setItem(`gk-session-token:competitions-${role}`, token); localStorage.setItem('accessToken', token);
      }, { theme, role });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== base) { entry.externalBlocked++; return route.abort(); }
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/api/users/me' && role === 'participant') {
          const response = await route.fetch(); return json({ ...await response.json(), id: 21 });
        }
        if (url.pathname === '/api/tournaments/301' && request.method() === 'GET') return json({ ...detail, staffAssignments: role === 'operator' ? detail.staffAssignments : [] });
        if (url.pathname === '/api/requests' && request.method() === 'GET') {
          const view = url.searchParams.get('view') || 'INCOMING';
          const pending = cases.filter(c => c.status === 'PENDING'), history = cases.filter(c => c.status !== 'PENDING');
          const visible = view === 'HISTORY' ? history : view === 'INCOMING' && role === 'operator' || view === 'OUTGOING' && role === 'participant' ? pending : [];
          return json({ items: visible.map(c => ({ key: `COMPETITION_CONCERN:${c.id}`, family: 'COMPETITION_CONCERN', id: c.id,
            title: 'Competition result concern', context: 'Tbilisi Community League', status: c.status, direction: role === 'operator' ? 'INCOMING' : 'OUTGOING',
            actionable: role === 'operator' && c.status === 'PENDING', updatedAt: '2026-10-30T10:00:00Z',
            destination: role === 'operator' ? `/tournaments/301/workspace?view=schedule&fixtureId=${fixture.id}` : `/tournaments/301?tab=matches&fixtureId=${fixture.id}`,
            actionLabel: role === 'operator' ? 'Review concern' : 'View concern receipt' })),
            counts: { incoming: role === 'operator' ? pending.length : 0, actionable: role === 'operator' ? pending.length : 0, outgoing: role === 'participant' ? pending.length : 0, history: history.length },
            total: visible.length, hasMore: false, unavailableSources: [] });
        }
        if (url.pathname === '/api/competitions/301/rules') {
          const response = await route.fetch(); return json({ ...await response.json(), revision });
        }
        if (url.pathname === `/api/competitions/301/fixtures/${fixture.id}/qualification-repair`) return json({ revision, available: true, paused, sourceStageId: fixture.stageId, fixtureIds: [fixtureIds.at(-1)] });
        if (url.pathname === `/api/competitions/301/fixtures/${fixture.id}/concerns` && request.method() === 'GET') return json(concernState(role));
        if (url.pathname === '/api/competitions/301/operations' && request.method() === 'GET') {
          const response = await route.fetch(), state = await response.json(); return json({ ...state, profile: { ...state.profile, revision }, canComplete: true });
        }
        if (request.method() === 'POST' && url.pathname.startsWith('/api/competitions/301/')) {
          const body = request.postDataJSON();
          entry.commands.push({ role, path: url.pathname, ...body });
          assert.ok(body.requestId); assert.ok(body.reason); assert.equal(body.revision, revision);
          if (url.pathname.endsWith('/concerns')) {
            assert.equal(role, 'participant'); assert.equal(body.entryId, fixture.homeEntryId); assert.equal(body.resultRevision, resultRevision);
            assert.equal(body.homeScore, undefined); assert.equal(body.awayScore, undefined);
            const concern = { id: 8001 + cases.length, entryId: fixture.homeEntryId, status: 'PENDING', version: 0, reason: body.reason, history: [{ action: 'SUBMITTED', reason: body.reason, at: '2026-10-30T10:00:00Z' }] };
            cases.push(concern); revision++; return json(concernState(role));
          }
          if (url.pathname.includes('/qualification/')) {
            assert.equal(role, 'operator'); assert.ok(url.pathname.endsWith('/reset')); paused = true; repaired = true; revision++;
            assert.deepEqual(detail.fixtures.map(f => f.id), fixtureIds); return json(detail);
          }
          if (url.pathname.endsWith('/review')) {
            assert.equal(role, 'operator'); assert.equal(body.resultRevision, resultRevision);
            const concern = cases.find(c => url.pathname.endsWith(`/${c.id}/review`)); assert.ok(concern); assert.equal(body.concernVersion, concern.version);
            if (body.action === 'CORRECT' && !repaired) return json({ message: 'Use Reset unplayed qualification slots on this source fixture, then retry the source correction. Existing fixture and match IDs are retained.' }, 409);
            if (body.action === 'CORRECT') {
              fixture.homeScore = body.homeScore; fixture.awayScore = body.awayScore;
              fixture.winnerEntryId = body.homeScore > body.awayScore ? fixture.homeEntryId : fixture.awayEntryId;
              concern.status = 'CORRECTED'; resultRevision++; paused = false;
            } else { assert.equal(body.action, 'REJECT'); assert.equal(body.homeScore, null); assert.equal(body.awayScore, null); concern.status = 'REJECTED'; }
            concern.version++; concern.history.push({ action: concern.status, reason: body.reason, at: '2026-10-30T10:30:00Z' }); revision++;
            assert.deepEqual(detail.fixtures.map(f => f.id), fixtureIds); return json(concernState(role));
          }
          if (url.pathname.endsWith('/finish')) {
            assert.equal(role, 'operator'); assert.equal(cases.some(c => c.status === 'PENDING'), false);
            assert.equal(detail.fixtures.every(f => f.status === 'COMPLETED'), true);
            detail.status = 'COMPLETED'; revision++;
            const response = await context.request.get(`${base}/api/competitions/301/operations`), state = await response.json();
            return json({ ...state, profile: { ...state.profile, revision }, canComplete: false });
          }
          throw new Error(`Unexpected mutation ${url.pathname}`);
        }
        return route.continue();
      });
      const page = await context.newPage(); page.on('pageerror', error => entry.failures.push(error.message)); return page;
    }
    async function capture(page, name, focus) {
      if (focus) await focus.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: overflow`);
      entry.captures.push(name);
    }
    async function openConcernFromRequests(page, view, name, expected) {
      await page.goto(`${base}/requests?view=needs-you&requestView=${view}`, { waitUntil: 'networkidle' });
      const link = page.getByRole('link', { name, exact: true }).first();
      await expect(link).toHaveAttribute('href', expected);
      await capture(page, `requests-${view.toLowerCase()}`, link);
      await link.click(); await expect(page).toHaveURL(`${base}${expected}`);
    }
    const participant = await contextFor('participant'), operator = await contextFor('operator');
    const publicUrl = `${base}/tournaments/301?tab=matches&fixtureId=${fixture.id}`;
    await participant.goto(publicUrl, { waitUntil: 'networkidle' });
    const receipt = participant.getByRole('region', { name: 'Result concerns', exact: true });
    await expect(receipt.getByLabel('Concern reason', { exact: true })).toBeVisible();
    assert.equal(await receipt.getByRole('spinbutton').count(), 0);
    await receipt.getByLabel('Concern reason', { exact: true }).fill('Synthetic participant asks for review of the original score sheet.');
    await receipt.getByRole('button', { name: 'Submit concern', exact: true }).click();
    await expect(receipt.getByText(/Awaiting organiser review/)).toBeVisible();
    await capture(participant, 'participant-pending', receipt);
    await openConcernFromRequests(participant, 'OUTGOING', 'Open request', `/tournaments/301?tab=matches&fixtureId=${fixture.id}`);
    await expect(receipt.getByText(/Awaiting organiser review/)).toBeVisible();
    await openConcernFromRequests(operator, 'INCOMING', 'Review concern', `/tournaments/301/workspace?view=schedule&fixtureId=${fixture.id}`);
    const dialog = operator.getByRole('dialog', { name: 'Match details', exact: true });
    const review = dialog.getByRole('region', { name: 'Result concerns', exact: true });
    await capture(operator, 'organiser-pending', dialog);
    await review.getByRole('combobox', { name: /Organiser decision/ }).selectOption('CORRECT');
    await review.getByLabel('Corrected home score', { exact: true }).fill('0'); await review.getByLabel('Corrected away score', { exact: true }).fill('9');
    const correctionReason = 'Synthetic organiser reviewed the original score sheet; corrected winner.';
    await review.getByLabel('Decision reason', { exact: true }).fill(correctionReason);
    await review.getByRole('button', { name: 'Record concern decision', exact: true }).click();
    await expect(review.getByRole('alert')).toContainText('Reset unplayed qualification slots');
    await capture(operator, 'blocked-with-repair', review);
    await dialog.getByRole('button', { name: 'Reset unplayed qualification slots', exact: true }).click();
    const confirm = operator.getByRole('dialog', { name: 'Review qualification repair', exact: true });
    await confirm.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(confirm).not.toBeVisible();
    await expect(dialog.getByText('Qualification is paused.', { exact: false })).toBeVisible();
    await capture(operator, 'qualification-paused', dialog);
    await expect(review.getByLabel(/^Decision reason/)).toHaveValue(correctionReason);
    await review.getByRole('button', { name: 'Record concern decision', exact: true }).click();
    await expect(review.getByText(/Result corrected/)).toBeVisible();
    await capture(operator, 'organiser-corrected', review);
    await participant.reload({ waitUntil: 'networkidle' });
    await expect(receipt.getByText(/Result corrected/)).toBeVisible();
    await receipt.getByText('Concern history', { exact: true }).click();
    await expect(receipt.getByText(correctionReason, { exact: false })).toBeVisible();
    await capture(participant, 'participant-corrected-receipt', receipt);
    await receipt.getByLabel('Concern reason', { exact: true }).fill('Synthetic second concern asks for a further review.');
    await receipt.getByRole('button', { name: 'Submit concern', exact: true }).click();
    await expect(receipt.getByText(/Awaiting organiser review/)).toBeVisible();
    await operator.reload({ waitUntil: 'networkidle' });
    await review.getByLabel('Decision reason', { exact: true }).fill('Synthetic organiser retained the verified corrected score.');
    await review.getByRole('button', { name: 'Record concern decision', exact: true }).click();
    await expect(review.getByText(/Concern rejected/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Close match', exact: true }).click();
    await operator.goto(`${base}/tournaments/301/workspace?view=bracket`, { waitUntil: 'networkidle' });
    await operator.getByText('Complete the competition season', { exact: true }).click();
    await operator.getByLabel('Completion reason', { exact: true }).fill('Synthetic finished season; all concerns have dispositions.');
    await operator.getByRole('button', { name: 'Complete season', exact: true }).click();
    await expect(operator.getByRole('button', { name: 'Complete season', exact: true })).not.toBeVisible();
    assert.equal(detail.status, 'COMPLETED');
    await openConcernFromRequests(participant, 'HISTORY', 'View outcome', `/tournaments/301?tab=matches&fixtureId=${fixture.id}`);
    await expect(receipt.getByText(/Result corrected/)).toBeVisible(); await expect(receipt.getByText(/Concern rejected/)).toBeVisible();
    await expect(receipt.getByRole('button', { name: 'Submit concern', exact: true })).not.toBeVisible();
    await capture(participant, 'participant-completed-return', receipt);
    assert.equal(cases.length, 2); assert.equal(entry.commands.filter(c => c.path.endsWith('/reset')).length, 1);
    assert.equal(entry.commands.filter(c => c.path.endsWith('/review')).length, 3);
    assert.ok(!entry.failures.length, JSON.stringify(entry.failures));
    for (const context of contexts) await context.close();
  }
} finally { await browser.close(); await writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report.map(({ theme, width, captures, commands, failures, externalBlocked }) => ({ theme, width, captures, commandCount: commands.length, failures, externalBlocked })), null, 2));
