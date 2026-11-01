import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { WaitingOnYou } from './WaitingOnYou';
import { HomeJoinActions } from './HomeJoinActions';
import { HomeResultAction } from './HomeResultAction';
import { requests, type RequestItem } from '../requests/api';
import { apiClient } from '../../api/axiosConfig';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: 'home-login' }) }));
vi.mock('../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (en: string) => en }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gk-session-id', 'home-login'); localStorage.setItem('userId', '1'); });
afterEach(() => { cleanup(); server.resetHandlers(); vi.restoreAllMocks(); });
const item = (id: number, values: Partial<RequestItem> = {}): RequestItem => ({ key: `PROJECT_STEP:${id}`, family: 'PROJECT_STEP', id, title: `Step ${id}`, context: 'Dinamo', status: 'PENDING', direction: 'INCOMING', actionable: true, updatedAt: `2026-10-${10 + id}T08:00:00Z`, destination: `/projects/${id}`, actionLabel: 'Open', ...values });
const page = (items: RequestItem[], hasMore = false, unavailableSources: string[] = []) => ({ items, hasMore, unavailableSources, complete: true, total: items.length, counts: { incoming: items.length, actionable: items.length, outgoing: 0, history: 0 } });
function Location() { return <output data-testid="location">{useLocation().search}</output>; }
const mount = () => render(<MemoryRouter><WaitingOnYou /><Location /></MemoryRouter>);

it.each(['WELFARE_WORK', 'CLUB_OPERATION_WORK', 'UNKNOWN', ''])('uses the actual %s family for a sealed work link on Home', async family => {
    const work = item(14, { key: `${family}:14`, family, title: 'Welfare work', context: 'Dinamo · Welfare · Scheduled',
        destination: '/clubs/1/office?tab=tools&tool=welfare&record=14&squad=3' });
    const post = vi.spyOn(apiClient, 'post');
    server.use(http.get('*/requests/pending', () => HttpResponse.json(page([work]))));
    mount(); await screen.findByText(work.title);
    if (family === 'WELFARE_WORK') {
        const link = screen.getByRole('link', { name: 'Open' });
        expect(link).toHaveAttribute('href', work.destination);
        fireEvent.click(link);
        expect(screen.getByTestId('location')).toHaveTextContent('?tab=tools&tool=welfare&record=14&squad=3');
    } else expect(screen.queryByRole('link', { name: 'Open' })).toBeNull();
    expect(screen.queryByRole('button', { name: /accept|confirm|approve/i })).toBeNull();
    expect(post).not.toHaveBeenCalled();
});

it.each(['staff-duties', 'facilities'])('keeps the canonical ordinary %s work link on Home', async tool => {
    const destination = `/clubs/1/office?tab=tools&tool=${tool}&record=14&squad=3`;
    server.use(http.get('*/requests/pending', () => HttpResponse.json(page([item(14, { family: 'CLUB_OPERATION_WORK', destination })]))));
    mount(); expect(await screen.findByRole('link', { name: 'Open' })).toHaveAttribute('href', destination);
});

it('clears sealed work when a refreshed Home read is denied', async () => {
    let denied = false;
    const work = item(14, { key: 'WELFARE_WORK:14', family: 'WELFARE_WORK', title: 'Welfare work',
        destination: '/clubs/1/office?tab=tools&tool=welfare&record=14' });
    server.use(http.get('*/requests/pending', () => denied ? new HttpResponse(null, { status: 403 }) : HttpResponse.json(page([work]))));
    mount(); await screen.findByRole('link', { name: 'Open' });
    denied = true;
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Some requests could not load');
    expect(screen.queryByText(work.title)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open' })).toBeNull();
});

it('reads one complete canonical snapshot, shows the oldest work first, and expands the rest in place', async () => {
    const calls: string[] = [];
    server.use(http.get('*/requests/pending', ({ request }) => {
        calls.push(new URL(request.url).search);
        return HttpResponse.json(page([item(3), item(2), item(1), item(9, { actionable: false })]));
    }));
    mount(); await screen.findByText('Step 1');
    expect(calls).toEqual(['']); expect(screen.queryByText('Step 3')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ 2 more' }));
    expect(screen.getAllByRole('listitem').map(row => row.textContent)).toEqual(['Step 1DinamoOpen', 'Step 2DinamoOpen', 'Step 3DinamoOpen']);
    expect(screen.queryByText('Step 9')).toBeNull();
});

it('distinguishes unavailable sources from empty work and recovers without an empty row', async () => {
    let retry = false;
    server.use(http.get('*/requests/pending', () => HttpResponse.json(page([], false, retry ? [] : ['MATCH_RESULT']))));
    mount(); expect(await screen.findByRole('alert')).toHaveTextContent('Some requests could not load');
    retry = true; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Waiting on you' })).toBeNull());
});

it('clears work answered elsewhere on the existing Inbox refresh, without adding a Home timer', async () => {
    let pending = true;
    const respond = () => HttpResponse.json(page(pending ? [item(1)] : []));
    server.use(http.get('*/requests/pending', respond), http.get('*/requests', respond));
    mount(); await screen.findByText('Step 1'); pending = false;
    await act(async () => { await requests('INCOMING', 0, 'home-login', new AbortController().signal, 1); });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Waiting on you' })).toBeNull());
});

it.each(['removal', 'equal-count replacement', 'reordering'])('keeps complete pending work through %s without independent offset reads', async change => {
    const rows = Array.from({ length: 51 }, (_, index) => item(index + 1, { updatedAt: new Date(Date.UTC(2026, 9, 1) + index * 1000).toISOString() }));
    let current = rows, calls = 0;
    server.use(http.get('*/requests/pending', () => { calls++; return HttpResponse.json(page(current)); }));
    mount(); await screen.findByText('Step 1');
    expect(calls).toBe(1);
    if (change === 'removal') current = rows.slice(1);
    else if (change === 'equal-count replacement') current = [item(99, { updatedAt: '2026-09-01T00:00:00Z' }), ...rows.slice(1)];
    else current = rows.map(row => row.id === 51 ? { ...row, updatedAt: '2026-09-01T00:00:00Z' } : row);
    await act(async () => { window.dispatchEvent(new Event('requests-updated')); });
    await screen.findByText(change === 'removal' ? 'Step 2' : change === 'equal-count replacement' ? 'Step 99' : 'Step 51');
    fireEvent.click(screen.getByRole('button', { name: /^\+ .* more$/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(current.length);
    if (change !== 'reordering') expect(screen.queryByText('Step 1')).toBeNull();
    expect(calls).toBe(2);
});

it('requires an explicit complete snapshot and offers recovery instead of claiming an incomplete read is empty', async () => {
    server.use(http.get('*/requests/pending', () => HttpResponse.json({ items: [], unavailableSources: [], complete: false })));
    mount(); expect(await screen.findByRole('alert')).toHaveTextContent('Some requests could not load');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
});

it('answers only the actual helper invitation and opens its existing session after acceptance', async () => {
    let accepted = false, posts = 0;
    server.use(http.get('*/requests/pending', () => HttpResponse.json(page(accepted ? [] : [item(72, { key: 'SESSION_HELPER:72', family: 'SESSION_HELPER', destination: '/home?helper=72' })]))),
        http.post('*/me/helping/72/accept', () => { posts++; accepted = true; return new HttpResponse(null, { status: 204 }); }));
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?helping=72'));
    expect(posts).toBe(1); await waitFor(() => expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull());
});

it('does not submit an old account’s pending invitation after a session swap', async () => {
    let posts = 0;
    server.use(http.get('*/requests/pending', () => HttpResponse.json(page([item(72, { key: 'SESSION_HELPER:72', family: 'SESSION_HELPER', destination: '/home?helper=72' })]))),
        http.post('*/me/helping/72/accept', () => { posts++; return new HttpResponse(null, { status: 204 }); }));
    mount(); const accept = await screen.findByRole('button', { name: 'Accept' });
    localStorage.setItem('gk-session-id', 'another-account'); fireEvent.click(accept);
    expect(posts).toBe(0);
});

it('opens the current staff-club choice from the canonical row', async () => {
    server.use(http.get('*/requests/pending', () => HttpResponse.json(page([item(1, { key: 'STAFF_CLUB_CHOICE:1', family: 'STAFF_CLUB_CHOICE', destination: '/me/staff-club' })]))));
    mount(); await screen.findByText('Choose your staff club');
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/me/staff-club');
});

it.each([true, false])('answers a project helper invitation with accept=%s using its existing command', async accept => {
    let answered = false, called = false;
    server.use(http.get('*/requests/pending', () => HttpResponse.json(page(answered ? [] : [item(12, { key: 'PROJECT_HELPER:12', family: 'PROJECT_HELPER', destination: '/home?projectHelper=12' })]))),
        http.post(`*/projects/12/helping/${accept ? 'accept' : 'decline'}`, () => { called = true; answered = true; return new HttpResponse(null, { status: 204 }); }));
    mount(); fireEvent.click(await screen.findByRole('button', { name: accept ? 'Accept' : 'Not for me' }));
    await waitFor(() => expect(called).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull());
});

it('keeps an uncertain join command through route unmount without sharing it with another login', async () => {
    const row = { id: 2, source: 'LINK', version: 3, groups: [{ id: 5, name: 'U14', version: 8 }] };
    const bodies: { requestId: string }[] = [];
    server.use(http.get('*/squad-communication/4/join-requests', () => HttpResponse.json([row])),
        http.post('*/squad-communication/4/join-requests/2', async ({ request }) => { bodies.push(await request.json() as { requestId: string }); return new HttpResponse(null, { status: 503 }); }));
    const editor = () => <MemoryRouter><HomeJoinActions squad={4} session="home-login" changed={() => {}} /></MemoryRouter>;
    const first = render(editor()); fireEvent.click(await screen.findByRole('button', { name: 'Approve all 1' })); await screen.findByRole('status'); first.unmount();
    render(editor()); fireEvent.click(await screen.findByRole('button', { name: 'Approve all 1' })); await screen.findByRole('status');
    expect(bodies).toHaveLength(2); expect(bodies[0].requestId).toBe(bodies[1].requestId);
});

it('reports partial group approvals honestly and retries the unresolved request with its original command id', async () => {
    const group = { id: 5, name: 'U14', version: 8 };
    const joins = [1, 2].map(id => ({ id, source: 'LINK', version: 3, groups: [group] }));
    const bodies: { id: string; body: { requestId: string } }[] = [];
    let phase = 0;
    server.use(http.get('*/squad-communication/4/join-requests', () => HttpResponse.json(phase ? joins.slice(1) : joins)),
        http.post('*/squad-communication/4/join-requests/:id', async ({ params, request }) => {
            bodies.push({ id: String(params.id), body: await request.json() as { requestId: string } });
            if (params.id === '1') return HttpResponse.json({ outcome: 'PLACE_OFFERED' });
            if (!phase) { phase++; return new HttpResponse(null, { status: 503 }); }
            return HttpResponse.json({ outcome: 'ALREADY_ANSWERED' });
        }));
    render(<MemoryRouter><HomeJoinActions squad={4} session="home-login" changed={() => {}} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve all 2' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1 offered a place · 0 other outcomes · 1 could not be confirmed');
    fireEvent.click(await screen.findByRole('button', { name: 'Approve all 1' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0 offered a place · 1 other outcomes · 0 could not be confirmed'));
    expect(bodies.map(b => b.id)).toEqual(['1', '2', '2']); expect(bodies[1].body.requestId).toBe(bodies[2].body.requestId);
});

it('confirms the displayed canonical score revision once and keeps review/dispute available', async () => {
    let writes = 0; let body: unknown;
    server.use(http.get('*/match-exchange/41/result', () => HttpResponse.json({ revision: 7, reported: { homeScore: 2, awayScore: 1 }, permissions: { respond: ['AWAY'] } })),
        http.post('*/match-exchange/41/result/confirm', async ({ request }) => { writes++; body = await request.json(); return HttpResponse.json({}); }));
    render(<MemoryRouter><HomeResultAction item={item(41, { family: 'MATCH_RESULT', actionLabel: 'CONFIRM', destination: '/matches/41' })} session="home-login" changed={() => {}} /></MemoryRouter>);
    const confirm = await screen.findByRole('button', { name: 'Confirm 2–1' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(writes).toBe(1)); expect(body).toMatchObject({ side: 'AWAY', revision: 7 });
    expect(screen.getByRole('button', { name: 'Review or dispute' })).toBeInTheDocument();
});
