import { Link } from 'react-router-dom';
import { Badge } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { ResultSummary } from '../../matchHistory/ResultSummary';
import { opponentName, type Match } from '../api';
import type { ScoreSummary } from '../../scores/api';
import { useWorldCopy } from '../../world/copy';
import { fixtureState, kickoffDay, kickoffTime } from './matchState';

function Team({ name, squad, logo, clubId, align }: { name: string; squad?: string | null; logo?: string | null; clubId?: number | null; align: 'home' | 'away' }) {
    const body = <><Crest src={logo} name={name} size={56} /><span className="gk-match-band__name"><strong>{name}</strong>{squad && <span>{squad}</span>}</span></>;
    return clubId ? <Link className={`gk-match-band__team gk-match-band__team--${align}`} to={`/clubs/${clubId}`}>{body}</Link>
        : <div className={`gk-match-band__team gk-match-band__team--${align}`}>{body}</div>;
}

/** The fixture at a glance: both teams, kick-off or the score, and where the arrangement stands. */
export function FixtureBand({ match: m, summary, invitedClub, now }: { match: Match; summary?: ScoreSummary; invitedClub?: { name: string; logoUrl?: string | null } | null; now: number }) {
    const t = useWorldCopy();
    const state = fixtureState(m, now);
    // Once a score exists in any state (reported, disputed, official, private) or the match has ended, the band shows it.
    const scored = summary && (summary.status !== 'NONE' || summary.legacy);
    const ended = new Date(m.ends_at_iso).getTime() <= now;
    return (
        <section className="gk-match-band" aria-label={t('Fixture')}>
            <Team align="home" name={m.club_name} squad={m.squad_name} logo={m.club_logo_url} clubId={m.club_id} />
            <div className="gk-match-band__centre">
                {scored || (summary && ended)
                    ? <ResultSummary homeScore={summary.homeScore} awayScore={summary.awayScore} status={summary.status} legacy={summary.legacy} fixtureStatus={summary.fixtureStatus} reported={summary.reported} disputed={summary.disputed} scorePrivate={summary.scorePrivate} ended={ended} compact />
                    : <><span className="gk-match-band__time gk-num">{kickoffTime(m)}</span><span className="gk-match-band__day">{kickoffDay(m)}</span></>}
                {/* A past match added afterwards says whose record it is (owner, 29 October 2026). */}
                <Badge tone={m.origin === 'PAST' ? 'neutral' : state.tone}>{m.origin === 'PAST' ? `${t('Added by')} ${m.club_name}` : t(state.label)}</Badge>
            </div>
            {opponentName(m)
                ? <Team align="away" name={opponentName(m)!} logo={m.opponent_logo_url} clubId={m.opponent_club_id}
                    squad={m.opponent_squad_name ?? (m.opponent_answer === 'WAITING' ? t('Asked to add it to their week') : m.outside_opponent ? t('Not in GrassKickZ') : null)} />
                : invitedClub
                    ? <Team align="away" name={invitedClub.name} logo={invitedClub.logoUrl} clubId={m.requested_club_id ?? m.opponent_asked_club}
                        squad={t(m.opponent_answer === 'WAITING' ? (m.can_answer_opponent ? 'Add it to your week, or say not us' : 'Asked to add it to their week')
                            : m.can_respond ? 'Your club is invited' : 'Invited · waiting for their reply')} />
                    : <div className="gk-match-band__team gk-match-band__team--away gk-match-band__team--open">
                        <span className="gk-match-band__slot" aria-hidden="true" />
                        <span className="gk-match-band__name"><strong>{t(m.listing_status === 'ARRANGED' ? 'Opponent not named' : 'Opponent to be agreed')}</strong>
                            <span>{t(m.listing_status === 'OPEN' ? 'Open challenge: squads can answer' : m.listing_status === 'ARRANGED' ? 'Staff can type its name' : 'No opponent')}</span></span>
                    </div>}
        </section>
    );
}
