import { fromCard, fromSummary, tournamentFact } from './tournamentItem';
import { dateColumn } from '../../format';
import type { CompetitionCard } from '../../../competitions/api';
import type { TournamentSummary } from '../../../tournaments/domain';

it('shows the competition day across the international date line and preserves its registration deadline', () => {
    const card = { id: 77, name: 'Auckland Cup', startDate: '2027-01-10T00:30+13:00', endDate: '2027-01-10T19:00+13:00', profile: { rules: { timezone: 'Pacific/Auckland' } } } as CompetitionCard;
    const item = fromCard(card);
    expect(dateColumn(item.start, item.rules?.timezone).time).toBe('10');
    expect(new Date(item.start!).toISOString()).toBe('2027-01-09T11:30:00.000Z');
    const summary = fromSummary({ ...card, registrationClosesAt: '2027-01-09T00:00+13:00' } as unknown as TournamentSummary, item.rules);
    expect(summary.closesAt).toBe('2027-01-09T00:00+13:00');
    expect(tournamentFact({ ...summary, status: 'PLANNING' }).label).toContain('8 Jan');
});
