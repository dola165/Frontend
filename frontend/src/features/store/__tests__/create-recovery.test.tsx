import { useContext, useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionBoundary } from '../../../context/AuthSessionBoundary';
import { CommerceDraftScope } from '../../../components/workspace/CommerceDraftScope';
import { CommerceDraftContext } from '../../../components/workspace/commerceDraftState';
import { StoreProductsPage } from '../../clubWorkspace/commerce/StoreProductsPage';
import { ClubStorePage } from '../../../pages/ClubStorePage';
import { useStoreCreateRecovery } from '../createRecovery';
// @ts-expect-error Process-local synthetic API modules are intentionally JavaScript.
import * as C from '../../../../sandbox/api/world-club.mjs';
// @ts-expect-error Process-local synthetic API modules are intentionally JavaScript.
import * as W from '../../../../sandbox/api/world.mjs';
// @ts-expect-error Process-local synthetic API modules are intentionally JavaScript.
import * as P from '../../../../sandbox/api/pages-data.mjs';
// @ts-expect-error Process-local synthetic API modules are intentionally JavaScript.
import * as V from '../../../../sandbox/api/viewer.mjs';

type Input = { name: string; price: number; currency: string; active: boolean; variants: { id?: number; label: string; stock: number }[]; version?: number };
type Reply = { status: number; body: Record<string, unknown> };
const f = vi.hoisted(() => ({ session: 'fixture', mode: 'normal', calls: [] as { url: string; input: Input; config: { headers: Record<string, string>; _authSessionId: string } }[], reads: [] as string[], patches: [] as { url: string; input: Input }[], pending: [] as { resolve: () => void; reject: () => void }[], context: null as null | { values: Map<string, unknown> } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 1 }, sessionId: f.session, isBootstrapping: false }) }));
vi.mock('../../../utils/authStorage', async original => ({ ...await original<typeof import('../../../utils/authStorage')>(), getStoredUserId: () => '1', getAuthSessionId: () => f.session,
    subscribeAuthSession: (listener: () => void) => { window.addEventListener('gk-auth-changed', listener); return () => window.removeEventListener('gk-auth-changed', listener); } }));
vi.mock('../../../api/axiosConfig', () => {
    const run = async (method: string, url: string, body?: unknown, headers = {}) => {
        // @ts-expect-error HTTP-shaped fixture boundary to the JavaScript synthetic router.
        const { handleApi } = await import('../../../../sandbox/api/router.mjs');
        // @ts-expect-error Process-local synthetic actor precondition, not a real auth action.
        const { accessToken } = await import('../../../../sandbox/api/viewer.mjs');
        // @ts-expect-error Process-local synthetic seed identity.
        const { ME_ID } = await import('../../../../sandbox/api/world.mjs');
        const parsed = new URL(url, 'https://process-local.invalid');
        const response = await handleApi({ method, path: parsed.pathname, query: parsed.searchParams, body, headers: { authorization: `Bearer ${accessToken(ME_ID)}`, ...headers } }) as Reply;
        if (!response || response.status >= 400) throw { response: { status: response?.status ?? 500, data: response?.body } };
        return { data: structuredClone(response.body) };
    };
    return { DEPLOYMENT_URLS: { mediaBaseUrl: 'https://process-local.invalid' }, apiClient: {
        get: (url: string) => { f.reads.push(url); return run('GET', url); },
        post: async (url: string, input: Input, config: { headers: Record<string, string>; _authSessionId: string }) => {
            const index = f.calls.length; f.calls.push({ url, input: structuredClone(input), config: structuredClone(config) });
            if (f.mode === 'first-rejected' && index === 0) throw { response: { status: 400, data: { message: 'Definite validation refusal' } } };
            const response = await run('POST', url, input, config.headers);
            if (f.mode === 'wrong-club' && index === 0) return { data: { ...response.data, clubId: 999999 } };
            if (f.mode === 'defer-all' || (f.mode === 'lost' && index === 0)) return new Promise((resolve, reject) => f.pending.push({ resolve: () => resolve(response), reject: () => reject(new Error('Modeled lost acknowledgement')) }));
            return response;
        },
        patch: (url: string, input: Input) => { f.patches.push({ url, input: structuredClone(input) }); return run('PATCH', url, input); },
    } };
});

function Capture() { const value = useContext(CommerceDraftContext); useEffect(() => { f.context = value; }, [value]); return null; }
const tree = (page: 'workspace' | 'public' = 'workspace', club = C.CLUB_ID) => <CommerceDraftScope clubId={club} feature="StoreTab"><Capture /><MemoryRouter initialEntries={[page === 'public' ? `/clubs/${club}/store?add=1` : `/clubs/${club}/workspace?tab=store`]}><AuthSessionBoundary><Routes>
    <Route path="/clubs/:id/store" element={<ClubStorePage />} /><Route path="/clubs/:id/workspace" element={<StoreProductsPage clubId={club} />} />
</Routes></AuthSessionBoundary></MemoryRouter></CommerceDraftScope>;
let seq = 0;
// Prime the large fixture router outside the first retry's action assertion window.
// @ts-expect-error The process-local fixture router is intentionally JavaScript.
beforeAll(async () => { await import('../../../../sandbox/api/handlers/index.mjs'); });
// Each test drives the real store page, its CSS and the synthetic API through several saves: 1-2 s on an idle machine,
// up to about 11 s with every core busy (measured). Role queries recompute styles after each render, so the cost is CPU,
// not waiting; nothing here sleeps. The 5 s default left no headroom, so this file gets a budget that matches its work.
vi.setConfig({ testTimeout: 30_000 });
beforeEach(() => { cleanup(); f.session = `fixed-session-${++seq}`; f.mode = 'normal'; f.calls = []; f.reads = []; f.patches = []; f.pending = []; f.context = null; sessionStorage.clear(); window.dispatchEvent(new Event('gk-auth-changed')); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function fill(page: 'workspace' | 'public' = 'workspace') {
    if (page === 'workspace') fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: `Recovery shirt ${seq}` } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '12.34' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
    fireEvent.change(screen.getByLabelText('Variant 1'), { target: { value: 'L' } });
    fireEvent.change(screen.getByLabelText('Stock 1'), { target: { value: '4' } });
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
async function lose() { await waitFor(() => expect(f.pending).toHaveLength(1)); await act(async () => f.pending[0].reject()); await screen.findByRole('alert'); }
const rows = () => C.products.filter((p: { name: string }) => p.name === `Recovery shirt ${seq}`);

describe('Pending definite-refusal retry correction', () => {
    it.each([false, true])('keeps a committed retry while separate confirmation was already open: %s', async alreadyOpen => {
        f.mode = 'first-rejected'; render(tree()); await fill(); save(); await screen.findByRole('alert');
        const original = f.calls[0], key = original.config.headers['Idempotency-Key'];
        if (alreadyOpen) fireEvent.click(screen.getByRole('button', { name: 'Start a separate product' }));
        f.mode = 'defer-all'; save(); await waitFor(() => expect(f.pending).toHaveLength(1));
        expect(f.calls[1]).toEqual(original); expect(rows()).toHaveLength(1);
        const separate = screen.queryByRole('button', { name: 'Start a separate product' });
        if (separate) fireEvent.click(separate);
        const confirmation = screen.queryByRole('button', { name: 'Start new draft' });
        if (confirmation) fireEvent.click(confirmation);
        expect(f.context!.values.get('create:attempt')).toMatchObject({ key, state: 'pending' });
        expect(Object.values(sessionStorage)).toContain(key);
        expect(screen.getByLabelText('Product name')).toHaveValue(`Recovery shirt ${seq}`);
        expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
        expect(!separate || separate.hasAttribute('disabled')).toBe(true);
        expect(!confirmation || confirmation.hasAttribute('disabled')).toBe(true);
        await act(async () => f.pending[0].resolve()); await screen.findByText('Product saved.');
        expect(rows()).toHaveLength(1); expect(f.calls).toHaveLength(2);
    });
    it('a stale controller finish callback cannot dispose a pending committed retry', async () => {
        let finish: (() => boolean) | undefined;
        function Actions() { const recovery = useStoreCreateRecovery(C.CLUB_ID); useEffect(() => { finish = recovery.finishReview; }); return null; }
        f.mode = 'first-rejected'; render(<CommerceDraftScope clubId={C.CLUB_ID} feature="StoreTab"><Actions />{tree()}</CommerceDraftScope>);
        await fill(); save(); await screen.findByRole('alert'); const staleFinish = finish!;
        const key = f.calls[0].config.headers['Idempotency-Key'];
        f.mode = 'defer-all'; save(); await waitFor(() => expect(f.pending).toHaveLength(1));
        let allowed: boolean | undefined; act(() => { allowed = staleFinish(); });
        expect(allowed).toBe(false); expect(f.context!.values.get('create:attempt')).toMatchObject({ key, state: 'pending' });
        expect(Object.values(sessionStorage)).toContain(key); expect(rows()).toHaveLength(1);
        await act(async () => f.pending[0].resolve()); await screen.findByText('Product saved.');
        expect(f.calls).toHaveLength(2); expect(rows()).toHaveLength(1);
    });
});

describe('Store create recovery with the actual process-local keyed contract', () => {
    it.each(['workspace', 'public'] as const)('replays one frozen request from %s while preserving its publication choice', async page => {
        f.mode = 'lost'; render(tree(page)); await fill(page); save();
        await waitFor(() => expect(f.pending).toHaveLength(1));
        fireEvent.click(screen.getByRole('button', { name: 'Saving…' })); fireEvent.submit(screen.getByRole('form', { name: 'Product editor' })); expect(f.calls).toHaveLength(1);
        await lose(); save(); await waitFor(() => expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument());
        expect(f.calls).toHaveLength(2); expect(f.calls[1]).toEqual(f.calls[0]); expect(rows()).toHaveLength(1);
        expect(rows()[0].active).toBe(page === 'public'); expect(f.calls[0].config._authSessionId).toBe(f.session);
        expect(Object.keys(sessionStorage).filter(k => k.startsWith('gk-store-create:'))).toHaveLength(0);
    });
    it('keeps the original key/body after same-login editor reopen', async () => {
        f.mode = 'lost'; const view = render(tree()); await fill(); save(); await lose();
        const key = f.calls[0].config.headers['Idempotency-Key'];
        view.unmount(); render(tree()); expect(await screen.findByLabelText('Product name')).toHaveValue(`Recovery shirt ${seq}`);
        save(); await screen.findByText('Product saved.'); expect(f.calls[1].config.headers['Idempotency-Key']).toBe(key); expect(rows()).toHaveLength(1);
    });
    it('holds changed answers and canonical later edits for explicit known-ID review and update', async () => {
        f.mode = 'lost'; render(tree()); await fill(); save(); await lose();
        fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Held local answer' } });
        const product = rows()[0]; Object.assign(product, { name: 'Other manager name', currency: 'GBP', version: 3, active: true }); product.variants[0].stock = 9;
        save(); await screen.findByText('The original product is saved. The answers below are still unsaved and have not been applied.');
        expect(screen.getByLabelText('Product name')).toHaveValue('Held local answer'); expect(screen.getByRole('button', { name: 'Save product' })).toBeDisabled();
        expect(f.calls[1]).toEqual(f.calls[0]); expect(f.patches).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Review saved products' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Edit Other manager name' }));
        expect(screen.getByLabelText('Product name')).toHaveValue('Other manager name'); expect(screen.getByLabelText('Stock 1')).toHaveValue(9);
        expect(screen.getByText('Held local answer')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Explicit reviewed edit' } }); save();
        await waitFor(() => expect(f.patches).toHaveLength(1)); expect(f.patches[0].url).toContain(`/products/${product.id}`);
        expect(f.patches[0].input.version).toBe(3); expect(f.patches[0].input.variants[0].id).toBe(product.variants[0].id);
    });
    it('a late reply after remount records a receipt without completing or clearing the replacement editor', async () => {
        f.mode = 'defer-all'; const view = render(tree()); await fill(); save(); await waitFor(() => expect(f.pending).toHaveLength(1));
        view.unmount(); render(tree()); await screen.findByLabelText('Product name');
        await act(async () => f.pending[0].resolve());
        expect(await screen.findByLabelText('Product name')).toHaveValue(`Recovery shirt ${seq}`); expect(screen.getByRole('button', { name: 'Save product' })).toBeDisabled();
        expect(screen.queryByText('Product saved.')).not.toBeInTheDocument(); expect(f.calls).toHaveLength(1);
    });
    it.each(['login', 'club'] as const)('a retired %s completion cannot clear or refresh a replacement pending create', async boundary => {
        f.mode = 'defer-all'; const view = render(tree()); await fill(); save(); await waitFor(() => expect(f.pending).toHaveLength(1));
        let club = C.CLUB_ID;
        if (boundary === 'login') { f.session += '-next'; window.dispatchEvent(new Event('gk-auth-changed')); }
        else {
            const owner = V.createAccount({ fullName: 'Process-local fixture owner', email: `store-scope-${seq}@example.test`, password: 'FixtureOnly123', dateOfBirth: '1990-01-01' });
            club = P.createPage(owner.id, { displayName: `Isolated recovery club ${seq}`, pageKind: 'CLUB', location: { city: 'Tbilisi' } }).body.clubId;
            P.clubPage(club).ownerId = W.ME_ID; P.clubPage(club).staff.delete(owner.id);
        }
        view.rerender(tree('workspace', club)); await fill(); fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Replacement answers' } }); save();
        await waitFor(() => expect(f.pending).toHaveLength(2)); const reads = f.reads.length;
        await act(async () => f.pending[0].resolve()); expect(screen.getByLabelText('Product name')).toHaveValue('Replacement answers');
        expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled(); expect(f.reads).toHaveLength(reads);
        expect(f.calls[1].config.headers['Idempotency-Key']).not.toBe(f.calls[0].config.headers['Idempotency-Key']);
        await act(async () => f.pending[1].resolve()); await screen.findByText('Product saved.');
    });
    it('a reload without the submitted body retains only an opaque marker and refuses a fresh create', async () => {
        f.mode = 'lost'; const view = render(tree()); await fill(); save(); await lose();
        const marker = Object.keys(sessionStorage).find(k => k.startsWith('gk-store-create:'))!; expect(sessionStorage.getItem(marker)).toMatch(/^[\da-f-]{36}$/i);
        expect(sessionStorage.getItem(marker)).not.toContain('Recovery shirt'); view.unmount(); f.context!.values.clear();
        render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
        expect(await screen.findByText(/original request is no longer in memory/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Save product' })).toBeDisabled(); expect(f.calls).toHaveLength(1);
    });
    it('a consumed-key conflict keeps original identity and current answers without recreating', async () => {
        f.mode = 'lost'; render(tree()); await fill(); save(); await lose(); const key = f.calls[0].config.headers['Idempotency-Key'];
        C.products.splice(C.products.indexOf(rows()[0]), 1); fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Still unsaved' } }); save();
        await screen.findByText('The original save needs review. This editor will not use a new key or create another product.');
        expect(f.calls[1].config.headers['Idempotency-Key']).toBe(key); expect(screen.getByLabelText('Description')).toHaveValue('Still unsaved'); expect(rows()).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Save product' })).toBeDisabled();
    });
    it('refuses dispatch if the opaque marker cannot be stored', async () => {
        render(tree()); await fill(); const set = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) { if (key.startsWith('gk-store-create:')) throw new Error('Blocked'); return set.call(this, key, value); }); save();
        await screen.findByText('Recovery storage is unavailable. Your answers are kept.'); expect(f.calls).toHaveLength(0); expect(screen.getByLabelText('Variant 1')).toHaveValue('L');
    });
    it('rejects a foreign canonical identity and recovers only the original club product', async () => {
        f.mode = 'wrong-club'; render(tree()); await fill(); save(); await screen.findByRole('alert'); expect(screen.getByLabelText('Product name')).toBeInTheDocument();
        save(); await screen.findByText('Product saved.'); expect(rows()).toHaveLength(1); expect(f.calls[1]).toEqual(f.calls[0]);
    });
    it('retains identity on a first definite rejection until an explicit separate-create confirmation', async () => {
        f.mode = 'first-rejected'; render(tree()); await fill(); save(); await screen.findByRole('alert');
        const firstKey = f.calls[0].config.headers['Idempotency-Key'];
        expect(Object.values(sessionStorage)).toContain(firstKey); expect(rows()).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Start a separate product' }));
        fireEvent.click(screen.getByRole('button', { name: 'Start new draft' }));
        expect(screen.getByLabelText('Product name')).toHaveValue(''); await fill('public'); save();
        await screen.findByText('Product saved.'); expect(f.calls[1].config.headers['Idempotency-Key']).not.toBe(firstKey); expect(rows()).toHaveLength(1);
    });
    it('closes an uncertain editor honestly and retains changed answers with its original request on reopen', async () => {
        f.mode = 'lost'; render(tree()); await fill(); save(); await lose();
        fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Held after close' } });
        fireEvent.click(screen.getByRole('button', { name: 'Close editor' })); fireEvent.click(screen.getByRole('button', { name: 'Close and keep answers' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Add product' })); expect(screen.getByLabelText('Product name')).toHaveValue('Held after close');
        save(); await screen.findByText('The original product is saved. The answers below are still unsaved and have not been applied.');
        expect(f.calls[1]).toEqual(f.calls[0]); expect(rows()).toHaveLength(1); expect(screen.getByLabelText('Product name')).toHaveValue('Held after close');
    });
});
