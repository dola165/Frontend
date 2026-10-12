import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { JourneyLauncher } from '../../../mapPlanning/JourneyLauncher';
import { matchGates, needsReferee } from '../../../matchExchange/detail/matchState';
import { ProposalList } from '../../../matchExchange/detail/OpponentPanels';
import { MatchParticipants } from '../../../matchExchange/MatchParticipants';
import { MatchResultSection } from '../../../matchExchange/MatchResultSection';
import { ScheduleResult } from '../../../matchHistory/ScheduleResult';
import { useArrangeableSquadsState } from '../../compose/useArrangeableSquads';
import { useWorldCopy } from '../../copy';
import { useNow } from '../../scoreboard/useNow';
import type { MatchPeekData } from './matchPeekData';
import { AnswerStep, GroundLine, OfferStep, RefereeLine } from './MatchSteps';
import { clearNotice, readNotice } from '../stepNotice';
import '../../../matchExchange/detail/match-detail.css';
import '../../../matchExchange/match-exchange.css';
import '../../../matchHistory/match-history.css';

/**
 * The one thing to do with a match now, by what is due: its result (record, confirm or dispute), else answering an
 * invitation, else the offers (choosing one, or your own waiting), else offering to play an open match, else picking the
 * players; with lines to find a referee or settle the ground while they are needed, and the journey to plan for a match
 * still to come. What a step just did is said first, and focus moves to it. Rare or destructive work stays on the full
 * match page.
 */
export function MatchAction({ data, reload }: { data: MatchPeekData; reload: () => void }) {
    const t = useWorldCopy();
    const now = useNow();
    const { squads, error, retry } = useArrangeableSquadsState();
    const [notice] = useState(readNotice);
    useEffect(() => clearNotice(), []);
    const { match: m, listing } = data;
    if (m.fixtureStatus === 'CANCELLED') return null;
    let step: ReactNode = null, page: ReactNode = null, journey = false, referee = false, ground = false, workspace = false;
    if (listing) {
        const gates = matchGates(listing, now, squads ?? []);
        const offers = listing.can_manage && listing.listing_status === 'OPEN' && (listing.proposals ?? []).some(offer => offer.status === 'PENDING');
        // An offer of ours still waiting: it shows (with Withdraw) instead of offering again.
        const offered = !listing.can_manage && (listing.proposals ?? []).some(offer => offer.status === 'PENDING' && squads?.some(squad => squad.id === offer.squad_id));
        // Answering and offering depend on the squads the person may arrange for: never "none" before they are known.
        const needsSquads = gates.respond || (gates.active && listing.listing_status === 'OPEN' && !listing.can_manage && !listing.requested_club_id);
        if (gates.finished || (gates.started && listing.opponent_name)) page = <MatchResultSection match={listing} reload={reload} scoreboard={false} />;
        else if (needsSquads && squads === undefined) step = error
            ? <p className="gk-step__error" role="alert">{t('Your squads could not load.')} <button type="button" className="gk-step__reload" onClick={retry}>{t('Try again')}</button></p>
            : null;
        else if (gates.respond) step = <AnswerStep listing={listing} squads={squads ?? []} reload={reload} />;
        else if (offers || offered) page = <ProposalList match={listing} active={gates.active} reload={reload} />;
        else if (gates.canPropose) step = <OfferStep listing={listing} squads={squads ?? []} reload={reload} />;
        else if (listing.listing_status === 'ARRANGED' && listing.can_arrange) page = <MatchParticipants match={listing} reload={reload} />;
        referee = gates.active && needsReferee(listing);
        ground = gates.active && Boolean(listing.can_arrange) && ['NEEDED', 'NEEDS_ATTENTION'].includes(listing.venue_status);
        journey = !gates.started && listing.listing_status === 'ARRANGED' && Boolean(listing.can_arrange);
    } else if (m.source === 'SCHEDULE' && m.startsAt) {
        const ended = Date.parse(m.endsAt ?? m.startsAt) <= now;
        if (ended) page = <ScheduleResult onSaved={reload} clubId={m.homeClubId} clubName={m.homeClubName}
            event={{ eventId: m.sourceId, eventType: 'MATCH', status: m.fixtureStatus, endsAt: m.endsAt ?? m.startsAt, homeScore: m.homeScore, awayScore: m.awayScore,
                resultStatus: m.resultStatus, matchExchangeId: null, canRecordResult: m.canRecordResult, opponentClubId: m.awayClubId }} />;
        else journey = true;
    } else if (m.source === 'TOURNAMENT' && m.tournamentId != null) {
        // The tournament's staff add its results in its workspace (the drawer has no tournament result step yet).
        workspace = m.canRecordResult && m.resultStatus !== 'RECORDED' && Boolean(m.startsAt) && Date.parse(m.startsAt!) <= now;
    }
    if (!notice && !step && !page && !journey && !referee && !ground && !workspace) return null;
    return (
        <section className="gk-mpeek__action">
            {notice && <p className="gk-step__done" role="status" tabIndex={-1} ref={node => node?.focus({ preventScroll: true })}>{notice}</p>}
            {step}
            {referee && listing && <RefereeLine listing={listing} />}
            {ground && listing && <GroundLine listing={listing} now={now} />}
            {workspace && <Link className="gk-step-line" to={`/tournaments/${m.tournamentId}/workspace?view=schedule&fixtureId=${m.sourceId}`}>
                <span>{t('Result to add')}</span><b>{t('Add it in the workspace')}</b><ArrowRight aria-hidden="true" />
            </Link>}
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
