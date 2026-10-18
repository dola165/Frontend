import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceDraftScope } from '../../../components/workspace/CommerceDraftScope';
import { useStoreMutationRecovery } from '../mutationRecovery';
import * as api from '../api';

const f = vi.hoisted(() => ({ session: 'mutation-login', actor: '18', done: vi.fn() }));
vi.mock('../../../utils/authStorage', async original => ({ ...await original<typeof import('../../../utils/authStorage')>(), getAuthSessionId: () => f.session, getStoredUserId: () => f.actor }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), updateStoreProduct: vi.fn(), deleteStoreProduct: vi.fn() }));
function Harness({ club = 69 }: { club?: number }) {
    const recovery = useStoreMutationRecovery(club);
    return <><output>{recovery.attempt?.state ?? 'ready'}</output><p role="alert">{recovery.error}</p>
        <button onClick={() => void recovery.run({ productId: 42, input: { name: 'Original', version: 3, variants: [{ id: 8, label: 'M', stock: 2 }] }, archive: false }, f.done)}>Save</button>
        <button onClick={() => void recovery.run({ productId: 42, input: { version: 3 }, archive: true }, f.done)}>Archive</button>
        <button onClick={() => void recovery.run(undefined, f.done)}>Retry</button><button onClick={recovery.review}>Review</button></>;
}
const tree = (club = 69) => <CommerceDraftScope clubId={club} feature="StoreTab"><Harness club={club} /></CommerceDraftScope>;
let seq=0;
beforeEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); f.session=`mutation-login-${++seq}`; f.actor='18'; });
afterEach(cleanup);
const saved = { id: 42, clubId: 69, name: 'Later name', version: 5, variants: [{ id: 8, label: 'L', stock: 1 }] };

describe('Versioned store mutation recovery', () => {
    it('retries the identical edit and key after a lost reply, accepts current later state', async () => {
        vi.mocked(api.updateStoreProduct).mockRejectedValueOnce(new Error('Lost reply')).mockResolvedValueOnce(saved);
        render(tree()); fireEvent.click(screen.getByText('Save')); await screen.findByText('uncertain');
        const original=structuredClone(vi.mocked(api.updateStoreProduct).mock.calls[0]);
        fireEvent.click(screen.getByText('Archive')); await screen.findByText('ready');
        expect(api.updateStoreProduct).toHaveBeenNthCalledWith(2,...original); expect(api.deleteStoreProduct).not.toHaveBeenCalled();
        expect(f.done).toHaveBeenCalledOnce(); expect(sessionStorage.length).toBe(0);
    });
    it('retries an archive receipt with the original version', async () => {
        vi.mocked(api.deleteStoreProduct).mockRejectedValueOnce(new Error('Lost reply')).mockResolvedValueOnce(undefined);
        render(tree());fireEvent.click(screen.getByText('Archive'));await screen.findByText('uncertain');
        const original=structuredClone(vi.mocked(api.deleteStoreProduct).mock.calls[0]);
        fireEvent.click(screen.getByText('Retry'));await screen.findByText('ready');
        expect(api.deleteStoreProduct).toHaveBeenNthCalledWith(2,...original);expect(f.done).toHaveBeenCalledOnce();
    });
    it('blocks parallel dispatches and does not discard an unresolved pending command', async () => {
        let resolve!: (value: api.StoreProduct) => void;
        vi.mocked(api.updateStoreProduct).mockImplementationOnce(() => new Promise(done => { resolve=done; }));
        render(tree());fireEvent.click(screen.getByText('Save'));fireEvent.click(screen.getByText('Save'));fireEvent.click(screen.getByText('Review'));
        expect(api.updateStoreProduct).toHaveBeenCalledOnce();expect(screen.getByText('pending')).toBeInTheDocument();
        await act(async () => resolve(saved));expect(f.done).toHaveBeenCalledOnce();
    });
    it('requires review after a stale or revoked command and never retries it automatically', async () => {
        vi.mocked(api.updateStoreProduct).mockRejectedValueOnce({ response: { status: 409, data: { message: 'Changed' } } });
        render(tree());fireEvent.click(screen.getByText('Save'));await screen.findByText('review');
        fireEvent.click(screen.getByText('Retry'));expect(api.updateStoreProduct).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByText('Review'));await screen.findByText('ready');expect(sessionStorage.length).toBe(0);
    });
    it('retains the original body across navigation and checks the same receipt', async () => {
        vi.mocked(api.updateStoreProduct).mockRejectedValueOnce(new Error('Lost reply')).mockResolvedValueOnce(saved);
        const first=render(tree());fireEvent.click(screen.getByText('Save'));await screen.findByText('uncertain');
        const original=structuredClone(vi.mocked(api.updateStoreProduct).mock.calls[0]);first.unmount();render(tree());
        expect(screen.getByText('uncertain')).toBeInTheDocument();fireEvent.click(screen.getByText('Retry'));await screen.findByText('ready');
        expect(api.updateStoreProduct).toHaveBeenNthCalledWith(2,...original);
    });
    it('blocks an opaque reload marker when its original private body is no longer in memory', async () => {
        sessionStorage.setItem(`gk-store-change:${f.session}:18:69`,crypto.randomUUID());render(tree());
        expect(screen.getByText('review')).toBeInTheDocument();fireEvent.click(screen.getByText('Save'));expect(api.updateStoreProduct).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('Review'));await screen.findByText('ready');
    });
    it('does not clear a replacement login or call its completion from an old response', async () => {
        let resolve!: (value: api.StoreProduct) => void;
        vi.mocked(api.updateStoreProduct).mockImplementationOnce(() => new Promise(done => { resolve=done; }));
        const first=render(tree());fireEvent.click(screen.getByText('Save'));await screen.findByText('pending');
        first.unmount();f.session+='-other';f.actor='26';render(tree());await act(async () => resolve(saved));
        expect(f.done).not.toHaveBeenCalled();expect(screen.getByText('ready')).toBeInTheDocument();
    });
    it('treats an inconsistent success response as uncertain instead of clearing edits', async () => {
        vi.mocked(api.updateStoreProduct).mockResolvedValueOnce({ ...saved, clubId: 70 });render(tree());
        fireEvent.click(screen.getByText('Save'));await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The change was not confirmed'));
        expect(screen.getByText('uncertain')).toBeInTheDocument();expect(f.done).not.toHaveBeenCalled();
    });
});
