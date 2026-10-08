import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchActivity } from './MatchActivity';
import { getMatchHistory, type HistoryMatch, type MatchHistoryPage } from '../matchHistory/api';

const auth = vi.hoisted(() => ({ user: { id: 1 } as { id: number } | null, sessionId: 'one' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../utils/authStorage', () => ({ isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('../matchHistory/api', () => ({ getMatchHistory: vi.fn() }));
const item: HistoryMatch = { id: 'event:1', source: 'SCHEDULE', sourceId: 1, title: 'Dinamo friendly', startsAt: '2026-10-10T12:00:00Z', endsAt: null, timezone: 'Asia/Tbilisi', homeClubId: 1, homeClubName: 'Dinamo', awayClubId: 2, awayClubName: 'Opponent', homeScore: null, awayScore: null, resultStatus: 'NONE', fixtureStatus: 'CONFIRMED', legacy: false, detailPath: '/events/1', canRecordResult: false };
const page = (items: HistoryMatch[]): MatchHistoryPage => ({ items, total: items.length, page: 0, pageSize: 3 });
const view = () => <MemoryRouter><MatchActivity /></MemoryRouter>;

describe('Personal fixture preview', () => {
    beforeEach(() => { vi.clearAllMocks(); auth.user = { id: 1 }; auth.sessionId = 'one'; });
    it('does not fetch personal records for guests', () => {
        auth.user = null; render(view());
        expect(screen.getByRole('link', { name: 'Sign in to see your matches' })).toHaveAttribute('href', '/login?returnTo=%2Fmatches');
        expect(getMatchHistory).not.toHaveBeenCalled();
    });
    it('shows the next fixture, links all upcoming activity and preserves canonical identity', async () => {
        vi.mocked(getMatchHistory).mockResolvedValue({ ...page([item, { ...item, id: 'event:2', title: 'Second fixture', homeClubName: 'Second club', detailPath: '/events/2' }]), total: 7 }); render(view());
        const link = await screen.findByRole('link', { name: /Dinamo.*Opponent/ });
        expect(link).toHaveAttribute('href', '/events/1');
        expect(getMatchHistory).toHaveBeenCalledWith('period=UPCOMING&mine=true&page=0&size=3', expect.any(AbortSignal), 'one');
        expect(screen.queryByRole('link', { name: /Second club/ })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: '7 upcoming fixtures' })).toHaveAttribute('href', '/matches?section=fixtures&period=UPCOMING&mine=true');
    });
    it('distinguishes failure from empty data and recovers through retry', async () => {
        vi.mocked(getMatchHistory).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(page([])); render(view());
        await screen.findByRole('alert'); expect(screen.queryByText(/No upcoming fixtures/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText(/No upcoming fixtures/)).toBeVisible();
    });
    it('ignores an old account response after changing sessions', async () => {
        let resolveOld!: (result: MatchHistoryPage) => void;
        vi.mocked(getMatchHistory).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(page([]));
        const rendered = render(view()); await waitFor(() => expect(getMatchHistory).toHaveBeenCalledTimes(1));
        auth.user = { id: 2 }; auth.sessionId = 'two'; rendered.rerender(view());
        await screen.findByText(/No upcoming fixtures/); resolveOld(page([item]));
        await waitFor(() => expect(screen.queryByRole('link', { name: /Dinamo.*Opponent/ })).not.toBeInTheDocument());
    });
});
