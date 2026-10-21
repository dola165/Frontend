import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import i18n from '../../../i18n';
import { clearStoredAuth, getAuthSessionId, setRefreshedAccessToken, setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';
import { DrawerFrame } from '../../world/peek/DrawerFrame';
import { DrawerPlaceContext } from '../../world/peek/drawerContext';
import { OfferStep } from '../../world/peek/match/MatchSteps';
import { clearNotice, readNotice } from '../../world/peek/stepNotice';
import { ProposeForm } from '../detail/OpponentPanels';
import type { Match, Squad } from '../api';

const auth = vi.hoisted(() => ({ id: 1, status: 'authenticated', session: undefined as string | undefined }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: auth.status, user: { id: auth.id }, sessionId: auth.session ?? getAuthSessionId() }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));
vi.mock('../../world/useWorldData', () => ({ useWorldData: () => ({ data: { busy: new Map() } }) }));

const squads: Squad[] = [
    { id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Our club' },
    { id: 104, club_id: 1, name: 'U14 Girls', category: 'U14', club_name: 'Our club' },
    { id: 105, club_id: 1, name: 'U16 Boys', category: 'U16', club_name: 'Our club' },
];
const fixture = (event_id: number, patch: Partial<Match> = {}) => ({
    event_id, revision: 4, club_id: 5, club_name: 'Riverside', squad_name: 'U14 Mixed', age_group: 'U14',
    listing_status: 'OPEN', event_status: 'SCHEDULED', starts_at_iso: '2099-10-17T11:00:00Z', ends_at_iso: '2099-10-17T12:30:00Z',
    requested_club_id: null, opponent_club_id: null, can_manage: false, ...patch,
} as Match);
const world = (id: number) => `/world/matches?tab=exchange&selected=x${id}&peek=match-x${id}`;
const exactNote = '  Our U14 can visit.\nPlease confirm the ground.  ';
const reload = vi.fn();
const drawerNote = () => screen.getByRole('textbox', { name: 'A word for their coach' });
const pageNote = () => screen.getByRole('textbox', { name: 'Message to the coach' });
const pageSquad = () => screen.getByRole('combobox', { name: 'Your squad' });
const back = () => fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }));
const full = () => fireEvent.click(screen.getByRole('link', { name: 'Match page' }));
const change = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const login = (id = 1) => { auth.id = id; auth.session = undefined; auth.status = 'authenticated'; setStoredUserId(id); setStoredAccessToken(`synthetic-offer-login-${id}`); };
const deferred = () => { let resolve!: (value: { data: unknown }) => void, reject!: (error: unknown) => void; const promise = new Promise<{ data: unknown }>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function Controls() {
    const navigate = useNavigate(), location = useLocation();
    return <nav><button onClick={() => navigate(-1)}>Browser Back</button><Link to={world(59)}>Other listing</Link><span aria-label="Route">{location.pathname}{location.search}</span></nav>;
}
function Form({ drawer, allowed, patch }: { drawer: boolean; allowed: Squad[]; patch: Partial<Match> }) {
    const location = useLocation(), params = useParams();
    const id = drawer ? Number(new URLSearchParams(location.search).get('selected')?.slice(1)) : Number(params.eventId);
    const match = fixture(id, patch);
    return drawer ? <DrawerPlaceContext.Provider value={{ side: 'right', place: 'drawer', close: vi.fn() }}>
        <DrawerFrame title={`Friendly ${id}`} page={{ to: `/match-exchange/${id}`, label: 'Match page' }}>
            <OfferStep listing={match} squads={allowed} reload={reload} />
        </DrawerFrame>
    </DrawerPlaceContext.Provider> : <ProposeForm match={match} squads={allowed} reload={reload} />;
}
function Journey({ allowed = squads, patch = {}, start = world(58) }: { allowed?: Squad[]; patch?: Partial<Match>; start?: string }) {
    return <MemoryRouter initialEntries={[start]}><Controls /><Routes>
        <Route path="/world/matches" element={<Form drawer allowed={allowed} patch={patch} />} />
        <Route path="/match-exchange/:eventId" element={<Form drawer={false} allowed={allowed} patch={patch} />} />
    </Routes></MemoryRouter>;
}

beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); clearNotice(); login();
    vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: {} });
});

describe('one in-memory offer across the actual drawer, full-page form and router Back', () => {
    it('keeps the exact note and nondefault squad in both directions without sending or storing it', () => {
        render(<Journey />);
        change(screen.getByRole('combobox', { name: 'Another squad' }), '105'); change(drawerNote(), exactNote); full();
        expect(pageSquad()).toHaveValue('105'); expect(pageNote()).toHaveValue(exactNote);
        change(pageSquad(), '104'); change(pageNote(), exactNote + '\nOne more question.'); back();
        expect(drawerNote()).toHaveValue(exactNote + '\nOne more question.');
        expect(screen.getByRole('button', { name: 'U14 Girls' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText('Route')).toHaveTextContent(world(58));
        expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('Please confirm the ground');
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('carries the eligible suggested squad even when the coach has not typed or chosen anything', () => {
        render(<Journey />); full(); expect(pageSquad()).toHaveValue('103'); expect(pageNote()).toHaveValue('');
        back(); expect(screen.getByRole('button', { name: 'U14 Boys' })).toHaveAttribute('aria-pressed', 'true');
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('keeps separate drafts for listings and restores each only to its own listing', () => {
        render(<Journey />); change(drawerNote(), 'Only for 58');
        fireEvent.click(screen.getByRole('link', { name: 'Other listing' })); expect(drawerNote()).toHaveValue('');
        change(drawerNote(), 'Only for 59'); full(); expect(pageNote()).toHaveValue('Only for 59');
        back(); back(); expect(drawerNote()).toHaveValue('Only for 58'); expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('retains the note but requires a new explicit selection if the old squad is no longer eligible', async () => {
        const view = render(<Journey />); change(screen.getByRole('combobox', { name: 'Another squad' }), '105'); change(drawerNote(), exactNote); full();
        view.rerender(<Journey allowed={[squads[0]]} />);
        expect(pageSquad()).toHaveValue(''); expect(pageNote()).toHaveValue(exactNote); expect(screen.getByRole('button', { name: 'Send proposal' })).toBeDisabled();
        fireEvent.submit(pageNote().closest('form')!); expect(apiClient.post).not.toHaveBeenCalled();
        view.rerender(<Journey />); expect(pageSquad()).toHaveValue('');
        change(pageSquad(), '103'); fireEvent.submit(pageNote().closest('form')!);
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledOnce());
        expect(apiClient.post).toHaveBeenCalledWith('/match-exchange/58/proposals', { squadId: 103, note: exactNote, revision: 4 }, expect.objectContaining({ _authSessionId: getAuthSessionId() }));
    });

    it('keeps a pending offer locked across navigation, then clears only on its acknowledgment and retains the receipt', async () => {
        const request = deferred(); vi.mocked(apiClient.post).mockReturnValueOnce(request.promise);
        render(<Journey />); change(drawerNote(), exactNote); const session = getAuthSessionId();
        const submit = screen.getByRole('button', { name: 'Offer to play' }); fireEvent.click(submit); fireEvent.click(submit); full();
        expect(pageNote()).toHaveValue(exactNote); expect(pageNote()).toBeDisabled(); expect(pageSquad()).toBeDisabled();
        fireEvent.submit(pageNote().closest('form')!); expect(apiClient.post).toHaveBeenCalledOnce(); back();
        expect(drawerNote()).toBeDisabled(); expect(screen.getByRole('button', { name: 'U14 Girls' })).toBeDisabled();
        await act(async () => request.resolve({ data: {} }));
        expect(drawerNote()).toHaveValue(''); expect(await screen.findByRole('status')).toHaveTextContent('offered to Riverside');
        expect(readNotice('match:58')).toContain('offered to Riverside');
        expect(readNotice('match:59')).toBeNull(); expect(readNotice()).toBeNull(); expect(reload).toHaveBeenCalledOnce();
        expect(apiClient.post).toHaveBeenCalledWith('/match-exchange/58/proposals', { squadId: 103, note: exactNote, revision: 4 }, expect.objectContaining({ _authSessionId: session }));
        full(); expect(pageNote()).toHaveValue(''); expect(screen.getByRole('button', { name: 'Send proposal' })).toBeDisabled();
    });

    it.each(['offline', 'unknown reply', 'conflict'] as const)('keeps exact input after %s across a pending full-page → Back transition', async failure => {
        const request = deferred(); vi.mocked(apiClient.post).mockReturnValueOnce(request.promise);
        render(<Journey />); change(drawerNote(), exactNote); full(); fireEvent.submit(pageNote().closest('form')!); back();
        const error = failure === 'conflict' ? { isAxiosError: true, response: { status: 409, data: { message: 'Match changed' } } } : new Error(failure);
        await act(async () => request.reject(error));
        expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(drawerNote()).toHaveValue(exactNote); expect(drawerNote()).toBeEnabled();
        expect(screen.getByRole('button', { name: 'U14 Boys' })).toHaveAttribute('aria-pressed', 'true');
        expect(apiClient.post).toHaveBeenCalledOnce(); expect(reload).not.toHaveBeenCalled(); expect(readNotice()).toBeNull();
        if (failure === 'conflict') expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Offer to play' }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
        expect(vi.mocked(apiClient.post).mock.calls[1][1]).toEqual(vi.mocked(apiClient.post).mock.calls[0][1]);
    });

    it('discards only by explicit action, leaves no sent receipt, and can start another draft', () => {
        render(<Journey />); change(drawerNote(), exactNote); full();
        expect(screen.getByText('Kept while you browse. Reloading clears this draft.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Discard draft' })); expect(pageNote()).toHaveValue('');
        back(); expect(drawerNote()).toHaveValue(''); expect(readNotice()).toBeNull(); expect(apiClient.post).not.toHaveBeenCalled();
        change(drawerNote(), 'A fresh note'); full(); expect(pageNote()).toHaveValue('A fresh note');
    });

    it('keeps current work through token refresh but retires it on another account or fresh login to the same account', () => {
        const view = render(<Journey />); change(drawerNote(), exactNote);
        act(() => setRefreshedAccessToken('synthetic-refresh', getAuthSessionId())); full(); expect(pageNote()).toHaveValue(exactNote);
        act(() => login(2)); view.rerender(<Journey />); expect(pageNote()).toHaveValue(''); change(pageNote(), 'Only account 2');
        act(() => login(1)); view.rerender(<Journey />); expect(pageNote()).toHaveValue(''); change(pageNote(), 'New login of 1');
        act(() => login(1)); expect(pageNote()).toHaveValue(''); expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('hides and refuses the retired form immediately while AuthContext still describes the old login', () => {
        const view = render(<Journey />); change(drawerNote(), exactNote); auth.session = getAuthSessionId()!;
        act(() => setStoredAccessToken('synthetic-next-login')); expect(drawerNote()).toHaveValue(''); expect(drawerNote()).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Offer to play' })); expect(apiClient.post).not.toHaveBeenCalled();
        auth.session = undefined; view.rerender(<Journey />); expect(drawerNote()).toBeEnabled(); expect(drawerNote()).toHaveValue('');
    });

    it.each(['ack', 'failure'] as const)('ignores an old login’s late %s while the fresh login has its own pending offer', async outcome => {
        const old = deferred(), current = deferred(); vi.mocked(apiClient.post).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
        const view = render(<Journey />); change(drawerNote(), 'Old login'); fireEvent.click(screen.getByRole('button', { name: 'Offer to play' }));
        act(() => { clearStoredAuth(); login(1); }); view.rerender(<Journey />); expect(drawerNote()).toHaveValue('');
        change(drawerNote(), 'Fresh login'); fireEvent.click(screen.getByRole('button', { name: 'Offer to play' }));
        await act(async () => { if (outcome === 'ack') old.resolve({ data: {} }); else old.reject(new Error('Old private error')); });
        expect(drawerNote()).toHaveValue('Fresh login'); expect(drawerNote()).toBeDisabled(); expect(reload).not.toHaveBeenCalled(); expect(readNotice()).toBeNull();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
        await act(async () => current.resolve({ data: {} })); expect(drawerNote()).toHaveValue(''); expect(reload).toHaveBeenCalledOnce();
    });

    it.each(['ack', 'failure'] as const)('does not let a late %s for another listing clear this listing or attach its receipt here', async outcome => {
        const request = deferred(); vi.mocked(apiClient.post).mockReturnValueOnce(request.promise);
        render(<Journey />); change(drawerNote(), 'For 58'); fireEvent.click(screen.getByRole('button', { name: 'Offer to play' }));
        fireEvent.click(screen.getByRole('link', { name: 'Other listing' })); change(drawerNote(), 'For 59');
        await act(async () => { if (outcome === 'ack') request.resolve({ data: {} }); else request.reject(new Error('Other listing error')); }); expect(drawerNote()).toHaveValue('For 59');
        expect(drawerNote()).toBeEnabled(); expect(reload).not.toHaveBeenCalled(); expect(readNotice()).toBeNull();
        back();
        if (outcome === 'ack') { expect(drawerNote()).toHaveValue(''); expect(screen.getByRole('status')).toHaveTextContent('offered to Riverside'); }
        else { expect(drawerNote()).toHaveValue('For 58'); expect(screen.getByRole('alert')).toBeInTheDocument(); }
    });

    it('refreshes a currently mounted full page after a conflict, retaining its exact input without retry or revision substitution', async () => {
        const error = { isAxiosError: true, response: { status: 409 } };
        vi.mocked(apiClient.post).mockRejectedValueOnce(error);
        render(<Journey start="/match-exchange/58" allowed={[squads[0]]} />); change(pageNote(), exactNote);
        fireEvent.submit(pageNote().closest('form')!);
        expect(await screen.findByRole('alert')).toHaveTextContent('This match changed'); expect(reload).toHaveBeenCalledOnce();
        expect(pageNote()).toHaveValue(exactNote); expect(pageSquad()).toHaveValue('103'); expect(apiClient.post).toHaveBeenCalledOnce();
        expect(vi.mocked(apiClient.post).mock.calls[0][1]).toEqual({ squadId: 103, note: exactNote, revision: 4 });
    });

    it('keeps same-login work while all forms are unmounted and retires that memory on logout without a mounted form', () => {
        const first = render(<Journey />); change(drawerNote(), exactNote); first.unmount();
        const returned = render(<Journey />); expect(drawerNote()).toHaveValue(exactNote); returned.unmount();
        act(() => { clearStoredAuth(); login(1); }); render(<Journey />); expect(drawerNote()).toHaveValue('');
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('clears an acknowledged offer even with both forms unmounted and returns its receipt without calling an old view', async () => {
        const request = deferred(); vi.mocked(apiClient.post).mockReturnValueOnce(request.promise);
        const first = render(<Journey />); change(drawerNote(), exactNote); fireEvent.click(screen.getByRole('button', { name: 'Offer to play' })); first.unmount();
        await act(async () => request.resolve({ data: {} })); expect(reload).not.toHaveBeenCalled();
        render(<Journey />); expect(drawerNote()).toHaveValue(''); expect(screen.getByRole('status')).toHaveTextContent('offered to Riverside');
        expect(apiClient.post).toHaveBeenCalledOnce();
    });

    it('retires an acknowledged World receipt on a fresh login as well as retiring the note', async () => {
        render(<Journey />); fireEvent.click(screen.getByRole('button', { name: 'Offer to play' }));
        await screen.findByRole('status'); expect(readNotice('match:58')).toContain('offered to Riverside');
        act(() => login(1)); expect(readNotice('match:58')).toBeNull(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(drawerNote()).toHaveValue(''); expect(drawerNote()).toBeEnabled();
    });

    it.each([{ can_manage: true }, { listing_status: 'CLOSED' }, { starts_at_iso: '2000-01-01T00:00:00Z' }] as Partial<Match>[])('refuses a stale/direct submit when the current match cannot take an offer (%j)', patch => {
        render(<Journey start="/match-exchange/58" patch={patch} allowed={[squads[0]]} />);
        fireEvent.submit(pageNote().closest('form')!); expect(apiClient.post).not.toHaveBeenCalled();
    });
});
