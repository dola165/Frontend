import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import i18n from '../../../i18n';
import { clearStoredAuth, getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';
import { ProposeForm } from '../detail/OpponentPanels';
import type { Match, Squad } from '../api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 1 }, sessionId: getAuthSessionId() }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost' } }));

const squads: Squad[] = [
    { id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Our club' },
    { id: 104, club_id: 1, name: 'U14 Girls', category: 'U14', club_name: 'Our club' },
];
// An open challenge for Sat 31 Oct and Sun 1 Nov, kick-off between 10:00 and 14:00 for a 90-minute match.
const challenge = (id: number, patch: Partial<Match> = {}) => ({
    event_id: id, revision: 4, club_id: 5, club_name: 'Riverside', squad_name: 'U14 Mixed', age_group: 'U14',
    listing_status: 'OPEN', event_status: 'SCHEDULED', starts_at: '2099-10-31T10:00:00', ends_at: '2099-11-01T14:00:00',
    starts_at_iso: '2099-10-31T06:00:00Z', ends_at_iso: '2099-11-01T10:00:00Z', window_from: '10:00:00', window_to: '14:00:00', match_minutes: 90,
    requested_club_id: null, opponent_club_id: null, can_manage: false, ...patch,
} as Match);
const reload = vi.fn();
const squad = () => screen.getByRole('combobox', { name: 'Your squad' });
const note = () => screen.getByRole('textbox', { name: 'Message to the coach' });
const time = () => screen.getByLabelText('Kick-off, between 10:00 and 12:30');
const sendButton = () => screen.getByRole('button', { name: 'Send our answer' });
const change = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const deferred = () => { let resolve!: (value: { data: unknown }) => void; const promise = new Promise<{ data: unknown }>(yes => { resolve = yes; }); return { promise, resolve }; };

function Page({ patch }: { patch: Partial<Match> }) {
    const { eventId } = useParams();
    return <ProposeForm match={challenge(Number(eventId), patch)} squads={squads} reload={reload} />;
}
function Away() {
    const navigate = useNavigate();
    return <><Link to="/matches/58">Back to 58</Link><button onClick={() => navigate('/matches/59')}>Open 59</button></>;
}
function Journey({ patch = {} }: { patch?: Partial<Match> }) {
    return <MemoryRouter initialEntries={['/matches/58']}><Routes>
        <Route path="/matches/:eventId" element={<><Page patch={patch} /><Link to="/elsewhere">Leave</Link></>} />
        <Route path="/elsewhere" element={<Away />} />
    </Routes></MemoryRouter>;
}

beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks(); clearStoredAuth(); setStoredUserId(1); setStoredAccessToken('synthetic-answer-login');
    vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: {} });
});

describe('answering an open challenge on the match page', () => {
    it('asks for a kick-off inside the window and sends it with the ground, so accepting can fix both', async () => {
        render(<Journey />);
        change(squad(), '104');
        expect(sendButton()).toBeDisabled();
        // 13:00 would end after 14:00: the latest kick-off is 12:30.
        change(time(), '13:00'); expect(sendButton()).toBeDisabled();
        fireEvent.click(screen.getByRole('radio', { name: /Sun/ }));
        change(time(), '11:30'); change(screen.getByRole('textbox', { name: 'Where, if you host (optional)' }), ' Pitch 2 ');
        change(note(), 'We can host.');
        expect(sendButton()).toBeEnabled(); fireEvent.click(sendButton());
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledOnce());
        expect(apiClient.post).toHaveBeenCalledWith('/match-exchange/58/proposals',
            { squadId: 104, note: 'We can host.', revision: 4, kickoffAt: '2099-11-01T11:30:00', locationName: 'Pitch 2' }, expect.anything());
        expect(await screen.findByRole('status')).toHaveTextContent('Your answer was sent');
    });

    it('keeps an unsent answer for this challenge only while the person browses, without storing it', () => {
        render(<Journey />);
        change(time(), '10:30'); change(note(), 'Only for 58');
        fireEvent.click(screen.getByRole('link', { name: 'Leave' }));
        fireEvent.click(screen.getByRole('button', { name: 'Open 59' })); expect(note()).toHaveValue('');
        fireEvent.click(screen.getByRole('link', { name: 'Leave' })); fireEvent.click(screen.getByRole('link', { name: 'Back to 58' }));
        expect(note()).toHaveValue('Only for 58'); expect(time()).toHaveValue('10:30');
        expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('Only for 58');
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('sends once while the answer is on its way and locks the form until it is acknowledged', async () => {
        const request = deferred(); vi.mocked(apiClient.post).mockReturnValueOnce(request.promise);
        render(<Journey />);
        change(squad(), '103'); change(time(), '12:00'); fireEvent.click(sendButton()); fireEvent.click(sendButton());
        expect(apiClient.post).toHaveBeenCalledOnce(); expect(note()).toBeDisabled();
        await act(async () => request.resolve({ data: {} }));
        expect(await screen.findByRole('status')).toHaveTextContent('Your answer was sent'); expect(reload).toHaveBeenCalledOnce();
    });

    it('keeps the exact answer after the challenge changed meanwhile, and reads it again', async () => {
        vi.mocked(apiClient.post).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } });
        render(<Journey />);
        change(squad(), '103'); change(time(), '12:00'); change(note(), 'Exact words'); fireEvent.click(sendButton());
        expect(await screen.findByRole('alert')).toHaveTextContent('This match changed'); expect(reload).toHaveBeenCalledOnce();
        expect(note()).toHaveValue('Exact words'); expect(time()).toHaveValue('12:00'); expect(note()).toBeEnabled();
    });

    it.each([{ can_manage: true }, { listing_status: 'CLOSED' }, { starts_at_iso: '2000-01-01T00:00:00Z', ends_at_iso: '2000-01-01T02:00:00Z' }] as Partial<Match>[])(
        'sends nothing when the challenge cannot take an answer (%j)', patch => {
            render(<Journey patch={patch} />);
            change(time(), '12:00'); fireEvent.submit(note().closest('form')!);
            expect(apiClient.post).not.toHaveBeenCalled();
        });
});
