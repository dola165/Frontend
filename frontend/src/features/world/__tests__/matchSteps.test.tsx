import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match, Squad } from '../../matchExchange/api';
import { answerInvitation, offerToPlay } from '../../matchExchange/detail/opponentActions';
import { AnswerStep, OfferStep, RefereeLine } from '../peek/match/MatchSteps';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', sessionId: getAuthSessionId(), user: { id: 1 } }) }));
vi.mock('../../matchExchange/detail/opponentActions', () => ({ offerToPlay: vi.fn(), answerInvitation: vi.fn() }));
/** Which days each of my squads already plays: U14 Boys on the 17th. */
vi.mock('../directories/matches/openMatches', () => ({ loadMyFit: async () => ({ squads: [], busy: new Map([[103, new Set(['2099-10-17'])]]), offered: new Set() }) }));

const squads: Squad[] = [
    { id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' },
    { id: 105, club_id: 1, name: 'U16 Boys', category: 'U16', club_name: 'Dinamo' },
];
const listing = (value: Partial<Match> = {}) => ({
    event_id: 58, revision: 4, club_id: 5, club_name: 'Locomotive', squad_name: 'U14 Boys', age_group: 'U14', listing_status: 'OPEN', event_status: 'SCHEDULED',
    starts_at_iso: '2099-10-17T11:00:00+04:00', ends_at_iso: '2099-10-17T12:20:00+04:00', timezone: 'Asia/Tbilisi', requested_club_id: null, requested_squad_id: null,
    referee_required: true, referee_status: 'NOT_REQUIRED', can_arrange_official: false, external_referee_name: null, ...value,
} as unknown as Match);
const show = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
beforeEach(() => { setStoredUserId(1); setStoredAccessToken('synthetic-match-steps-login'); });

describe('offering to play inside the match drawer', () => {
    beforeEach(() => vi.clearAllMocks());

    it('chooses the squad that fits the age group, warns when it already plays that day, and says what is sent', async () => {
        const reload = vi.fn();
        vi.mocked(offerToPlay).mockResolvedValue(undefined as never);
        show(<OfferStep listing={listing()} squads={squads} reload={reload} />);
        expect(screen.getByRole('button', { name: 'U14 Boys' })).toHaveAttribute('aria-pressed', 'true');
        expect(await screen.findByText('U14 Boys already plays that day')).toBeInTheDocument();
        expect(screen.getByText('Offers U14 Boys to Locomotive. They choose one offer; nothing is agreed until they accept.')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Another squad'), { target: { value: '105' } });
        fireEvent.change(screen.getByLabelText('A word for their coach'), { target: { value: ' Happy to travel ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Offer to play' }));
        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(offerToPlay).toHaveBeenCalledWith(expect.objectContaining({ event_id: 58 }), 105, ' Happy to travel ', getAuthSessionId());
    });

    it('keeps the choice and says why when the offer could not be sent', async () => {
        vi.mocked(offerToPlay).mockRejectedValue(new Error('offline'));
        show(<OfferStep listing={listing()} squads={squads} reload={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Offer to play' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'U14 Boys' })).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('answering an invitation inside the match drawer', () => {
    beforeEach(() => vi.clearAllMocks());
    const invitation = listing({ requested_club_id: 1, requested_squad_id: 103, can_respond: true });

    it('accepts with the squad they asked for', async () => {
        const reload = vi.fn();
        vi.mocked(answerInvitation).mockResolvedValue(undefined as never);
        show(<AnswerStep listing={invitation} squads={squads} reload={reload} />);
        expect(screen.getByText('Locomotive invited you to play')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(answerInvitation).toHaveBeenCalledWith(invitation, { accept: true, squadId: 103 });
    });

    it('declines only after a second press', async () => {
        vi.mocked(answerInvitation).mockResolvedValue(undefined as never);
        show(<AnswerStep listing={invitation} squads={squads} reload={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
        expect(answerInvitation).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Decline the invitation' }));
        await waitFor(() => expect(answerInvitation).toHaveBeenCalledWith(invitation, { accept: false }));
    });
});

describe('a match without a referee', () => {
    it('leads to the referees who fit it, only for whoever arranges the referee', () => {
        const { unmount } = show(<RefereeLine listing={listing({ referee_status: 'NEEDED', can_arrange_official: true })} />);
        expect(screen.getByRole('link', { name: /Referee needed/ })).toHaveAttribute('href', '/world/people?tab=referees&match=58');
        unmount();
        const { container } = show(<RefereeLine listing={listing({ referee_status: 'NEEDED', can_arrange_official: false })} />);
        expect(container.textContent).toBe('');
    });
});
