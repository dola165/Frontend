import { Link } from 'react-router-dom';
import { Badge } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { ResultSummary } from '../../matchHistory/ResultSummary';
import type { Match, PublicMatchResult } from '../api';
import { useWorldCopy } from '../../world/copy';
import { fixtureState, kickoffDay, kickoffTime } from './matchState';

function Team({ name, squad, logo, clubId, align }: { name: string; squad?: string | null; logo?: string | null; clubId?: number | null; align: 'home' | 'away' }) {
    const body = <><Crest src={logo} name={name} size={56} /><span className="gk-match-band__name"><strong>{name}</strong>{squad && <span>{squad}</span>}</span></>;
    return clubId ? <Link className={`gk-match-band__team gk-match-band__team--${align}`} to={`/clubs/${clubId}`}>{body}</Link>
        : <div className={`gk-match-band__team gk-match-band__team--${align}`}>{body}</div>;
}

/** The fixture at a glance: both teams, kick-off or the score, and where the arrangement stands. */
export function FixtureBand({ match: m, summary, invitedClub, now }: { match: Match; summary?: PublicMatchResult; invitedClub?: { name: string; logoUrl?: string | null } | null; now: number }) {
    const t = useWorldCopy();
    const state = fixtureState(m, now);
    const scored = summary && summary.homeScore != null && summary.awayScore != null;
    const ended = new Date(m.ends_at_iso).getTime() <= now;
    return (
        <section className="gk-match-band" aria-label={t('Fixture')}>
            <Team align="home" name={m.club_name} squad={m.squad_name} logo={m.club_logo_url} clubId={m.club_id} />
            <div className="gk-match-band__centre">
                {scored || (summary && ended)
                    ? <ResultSummary homeScore={summary.homeScore} awayScore={summary.awayScore} status={summary.status} legacy={summary.legacy} fixtureStatus={summary.fixtureStatus} ended={ended} compact />
                    : <><span className="gk-match-band__time gk-num">{kickoffTime(m)}</span><span className="gk-match-band__day">{kickoffDay(m)}</span></>}
                <Badge tone={state.tone}>{t(state.label)}</Badge>
            </div>
            {m.opponent_name
                ? <Team align="away" name={m.opponent_name} squad={m.opponent_squad_name} clubId={m.opponent_club_id} />
                : invitedClub
                    ? <Team align="away" name={invitedClub.name} squad={t(m.can_respond ? 'Your club is invited' : 'Invited · waiting for their reply')} logo={invitedClub.logoUrl} clubId={m.requested_club_id} />
                    : <div className="gk-match-band__team gk-match-band__team--away gk-match-band__team--open">
                        <span className="gk-match-band__slot" aria-hidden="true" />
                        <span className="gk-match-band__name"><strong>{t('Opponent to be agreed')}</strong><span>{t(m.listing_status === 'OPEN' ? 'Squads can propose to play' : 'No opponent')}</span></span>
                    </div>}
        </section>
    );
}
