import type { ReactNode } from 'react';
import { JourneyLauncher } from '../../../mapPlanning/JourneyLauncher';
import { matchGates, needsReferee } from '../../../matchExchange/detail/matchState';
import { ProposalList } from '../../../matchExchange/detail/OpponentPanels';
import { MatchParticipants } from '../../../matchExchange/MatchParticipants';
import { MatchResultSection } from '../../../matchExchange/MatchResultSection';
import { ScheduleResult } from '../../../matchHistory/ScheduleResult';
import { useArrangeableSquads } from '../../compose/useArrangeableSquads';
import { useNow } from '../../scoreboard/useNow';
import type { MatchPeekData } from './matchPeekData';
import { AnswerStep, OfferStep, RefereeLine } from './MatchSteps';
import '../../../matchExchange/detail/match-detail.css';
import '../../../matchExchange/match-exchange.css';
import '../../../matchHistory/match-history.css';

/**
 * The one thing to do with a match now, by what is due: its result (record, confirm or dispute), else answering an
 * invitation, else the offers (choosing one, or your own waiting), else offering to play an open match, else picking the
 * players; with a line to find a referee while one is needed, and the journey to plan for a match still to come. Rare
 * or destructive work stays on the full match page.
 */
export function MatchAction({ data, reload }: { data: MatchPeekData; reload: () => void }) {
    const now = useNow();
    const squads = useArrangeableSquads() ?? [];
    const { match: m, listing } = data;
    if (m.fixtureStatus === 'CANCELLED') return null;
    let step: ReactNode = null, page: ReactNode = null, journey = false, referee = false;
    if (listing) {
        const gates = matchGates(listing, now, squads);
        const offers = listing.can_manage && listing.listing_status === 'OPEN' && (listing.proposals ?? []).some(offer => offer.status === 'PENDING');
        // An offer of ours still waiting: it shows (with Withdraw) instead of offering again.
        const offered = !listing.can_manage && (listing.proposals ?? []).some(offer => offer.status === 'PENDING' && squads.some(squad => squad.id === offer.squad_id));
        if (gates.finished || (gates.started && listing.opponent_name)) page = <MatchResultSection match={listing} reload={reload} scoreboard={false} />;
        else if (gates.respond) step = <AnswerStep listing={listing} squads={squads} reload={reload} />;
        else if (offers || offered) page = <ProposalList match={listing} active={gates.active} reload={reload} />;
        else if (gates.canPropose) step = <OfferStep listing={listing} squads={squads} reload={reload} />;
        else if (listing.listing_status === 'ARRANGED' && listing.can_arrange) page = <MatchParticipants match={listing} reload={reload} />;
        referee = gates.active && needsReferee(listing);
        journey = !gates.started && listing.listing_status === 'ARRANGED' && Boolean(listing.can_arrange);
    } else if (m.source === 'SCHEDULE' && m.startsAt) {
        const ended = Date.parse(m.endsAt ?? m.startsAt) <= now;
        if (ended) page = <ScheduleResult onSaved={reload} clubId={m.homeClubId} clubName={m.homeClubName}
            event={{ eventId: m.sourceId, eventType: 'MATCH', status: m.fixtureStatus, endsAt: m.endsAt ?? m.startsAt, homeScore: m.homeScore, awayScore: m.awayScore,
                resultStatus: m.resultStatus, matchExchangeId: null, canRecordResult: m.canRecordResult, opponentClubId: m.awayClubId }} />;
        else journey = true;
    }
    if (!step && !page && !journey && !referee) return null;
    return (
        <section className="gk-mpeek__action">
            {step}
            {referee && listing && <RefereeLine listing={listing} />}
            {(page || journey) && (
                /* The match page's own pieces, in its look. */
                <div className="gk gk-match gk-mx">
                    {page}
                    {journey && <JourneyLauncher eventId={m.sourceId} />}
                </div>
            )}
        </section>
    );
}
