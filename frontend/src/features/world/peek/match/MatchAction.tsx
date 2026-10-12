import type { ReactNode } from 'react';
import { JourneyLauncher } from '../../../mapPlanning/JourneyLauncher';
import { matchGates } from '../../../matchExchange/detail/matchState';
import { ProposalList } from '../../../matchExchange/detail/OpponentPanels';
import { MatchParticipants } from '../../../matchExchange/MatchParticipants';
import { MatchResultSection } from '../../../matchExchange/MatchResultSection';
import { ScheduleResult } from '../../../matchHistory/ScheduleResult';
import { useNow } from '../../scoreboard/useNow';
import type { MatchPeekData } from './matchPeekData';
import '../../../matchExchange/detail/match-detail.css';
import '../../../matchExchange/match-exchange.css';
import '../../../matchHistory/match-history.css';

/**
 * The one thing to do with a match now, by what is due: its result (record, confirm or dispute), else choosing
 * an offer, else picking the players; with the journey to plan beside it for a match still to come. Proposing and
 * answering an invitation, and rare or destructive work, stay on the full match page.
 */
export function MatchAction({ data, reload }: { data: MatchPeekData; reload: () => void }) {
    const now = useNow();
    const { match: m, listing } = data;
    if (m.fixtureStatus === 'CANCELLED') return null;
    let main: ReactNode = null, journey = false;
    if (listing) {
        const gates = matchGates(listing, now);
        const offers = listing.can_manage && listing.listing_status === 'OPEN' && (listing.proposals ?? []).some(offer => offer.status === 'PENDING');
        if (gates.finished || (gates.started && listing.opponent_name)) main = <MatchResultSection match={listing} reload={reload} scoreboard={false} />;
        else if (offers) main = <ProposalList match={listing} active={gates.active} reload={reload} />;
        else if (listing.listing_status === 'ARRANGED' && listing.can_arrange) main = <MatchParticipants match={listing} reload={reload} />;
        journey = !gates.started && listing.listing_status === 'ARRANGED' && Boolean(listing.can_arrange);
    } else if (m.source === 'SCHEDULE' && m.startsAt) {
        const ended = Date.parse(m.endsAt ?? m.startsAt) <= now;
        if (ended) main = <ScheduleResult onSaved={reload} clubId={m.homeClubId} clubName={m.homeClubName}
            event={{ eventId: m.sourceId, eventType: 'MATCH', status: m.fixtureStatus, endsAt: m.endsAt ?? m.startsAt, homeScore: m.homeScore, awayScore: m.awayScore,
                resultStatus: m.resultStatus, matchExchangeId: null, canRecordResult: m.canRecordResult, opponentClubId: m.awayClubId }} />;
        else journey = true;
    }
    if (!main && !journey) return null;
    return (
        <section className="gk-mpeek__action">
            {/* The match page's own pieces, in its look. */}
            <div className="gk gk-match gk-mx">
                {main}
                {journey && <JourneyLauncher eventId={m.sourceId} />}
            </div>
        </section>
    );
}
