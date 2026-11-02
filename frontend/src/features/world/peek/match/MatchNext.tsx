import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useWorldCopy } from '../../copy';
import { useNow } from '../../scoreboard/useNow';
import type { MatchPeekData } from './matchPeekData';
import '../step.css';

/**
 * What the match waits for from the viewer, as one line that opens its page: the drawer summarises and the match page
 * acts (step 6). An invitation or a club's "added a match against you" to answer, answers to an open challenge to choose
 * from, a result to report; nothing due shows nothing, and the page is one link away in the drawer's head anyway.
 */
export function MatchNext({ data }: { data: MatchPeekData }) {
    const t = useWorldCopy();
    const now = useNow();
    const { match: m, listing } = data;
    if (m.fixtureStatus === 'CANCELLED') return null;
    let due: { state: string; action: string; to: string } | null = null;
    if (listing) {
        const page = `/matches/${listing.event_id}?from=world`;
        const started = Date.parse(listing.starts_at_iso) <= now;
        const answers = (listing.proposals ?? []).filter(offer => offer.status === 'PENDING').length;
        if (listing.can_respond) due = { state: t('Your club is invited'), action: t('Answer'), to: page };
        else if (listing.can_answer_opponent) due = { state: t('Added against your club'), action: t('Answer'), to: page };
        else if (listing.can_manage && listing.listing_status === 'OPEN' && answers) due = { state: t('{count} answers', { count: answers }), action: t('Choose one'), to: page };
        else if (started && listing.can_record_result && (listing.result_status ?? 'NONE') === 'NONE') due ={ state: t('Result to add'), action: t('Report the score'), to: `${page}#result` };
    } else if (m.source === 'TOURNAMENT' && m.tournamentId != null && m.canRecordResult && m.resultStatus !== 'RECORDED' && m.startsAt && Date.parse(m.startsAt) <= now) {
        // The tournament's staff add its results in its workspace.
        due = { state: t('Result to add'), action: t('Add it in the workspace'), to: `/tournaments/${m.tournamentId}/workspace?view=schedule&fixtureId=${m.sourceId}` };
    }
    return due && <Link className="gk-step-line" to={due.to}><span>{due.state}</span><b>{due.action}</b><ArrowRight aria-hidden="true" /></Link>;
}
