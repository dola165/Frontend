import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useArrangeLink } from '../../compose/useArrangeLink';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { calendarDaysUntil, fixtureDay, fixtureTime, shortDate } from '../../format';
import { FormGuide } from '../../scoreboard/FormGuide';
import { tally } from '../../scoreboard/form';
import { opponentIn, type NextUp } from './coachMatches';
import { HistoryLine, type CrestOf } from '../../scoreboard/HistoryLine';
import './coach.css';
import './next-opponent.css';

type Team = { club: string; squad?: string | null; logo?: string | null } | null;

/** One side of the fixture: a big crest, the club, the squad under it; an unknown opponent says so. */
function TeamBlock({ team }: { team: Team }) {
    const t = useWorldCopy();
    if (!team) return <span className="gk-nextop__team" data-tbd><span className="gk-nextop__tbd" aria-hidden="true">?</span><b>{t('To be decided')}</b></span>;
    return <span className="gk-nextop__team"><Crest src={team.logo} name={team.club} size={40} round /><b>{team.club}</b>{team.squad && <small>{team.squad}</small>}</span>;
}

/**
 * A squad's next match as a coach reads it before the week starts: when and where, the two crests, the
 * opponent's form and goals, when we last met, their last results, and who comes after. Says plainly when
 * there is no fixture or the opponent is still to be decided.
 */
export function NextOpponentCard({ up, crestOf, emphasis, results = 3 }: {
    up: NextUp; crestOf: CrestOf;
    /** Goalkeeper coaches read goals first. */ emphasis?: 'goals'; /** How many of their results to list. */ results?: number;
}) {
    const t = useWorldCopy();
    const arrange = useArrangeLink();
    const { squad, next, opponent, scout, upcoming } = up;
    if (!next) return (
        <article className="gk-nextop" aria-label={squad.name}>
            <header className="gk-nextop__when"><span className="gk-nextop__squad">{squad.name}</span></header>
            <p className="gk-nextop__empty">{t('No fixture booked for {squad}', { squad: squad.name })}</p>
            <Link className="gk-nextop__go" {...arrange({ mode: 'open', squadId: squad.id })}>{t('Find an opponent')}<ArrowRight aria-hidden="true" /></Link>
        </article>
    );
    const left = calendarDaysUntil(next.startsAt);
    const mine: Team = { club: opponent?.myClub || t('Your club'), squad: squad.name, logo: crestOf(squad.clubId) };
    const theirs: Team = opponent?.clubId ? { club: opponent.club ?? opponent.name, squad: opponent.squad, logo: crestOf(opponent.clubId) } : null;
    const atHome = opponent?.home ?? true;
    const goals = scout?.form.length ? tally(scout.form) : null;
    const perGame = (value: number) => (value / goals!.played).toFixed(1);
    const later = upcoming.slice(1, 4).flatMap(match => { const other = opponentIn(match, squad); return other?.clubId ? [{ match, other }] : []; });
    const formLabel = scout?.scope === 'age' ? t('{club} {age} form', { club: theirs?.club ?? '', age: squad.ageGroup }) : t('Their form');
    return (
        <article className="gk-nextop" aria-label={`${squad.name}: ${next.title}`}>
            <header className="gk-nextop__when">
                <span className="gk-nextop__squad">{squad.name}</span>
                <b>{fixtureDay(next.startsAt, next.timezone)} · {fixtureTime(next.startsAt, next.timezone)}</b>
                {left != null && left > 1 && <small>{t('in {count} days', { count: left })}</small>}
            </header>
            <Link className="gk-nextop__teams" to={next.detailPath}>
                <TeamBlock team={atHome ? mine : theirs} /><span className="gk-nextop__vs">{t('vs')}</span><TeamBlock team={atHome ? theirs : mine} />
            </Link>
            <p className="gk-nextop__where">{[next.tournamentName || (next.source === 'MATCH_EXCHANGE' ? t('Friendly') : t('Club fixture')), next.locationName].filter(Boolean).join(' · ')}</p>
            {theirs && scout && <dl className="gk-nextop__facts" data-emphasis={emphasis}>
                <div className="gk-nextop__form"><dt>{formLabel}</dt><dd><FormGuide results={scout.form} /></dd></div>
                {goals && <div className="gk-nextop__goals"><dt>{t('Goals')}</dt><dd>{emphasis === 'goals'
                    ? t('They score {for} and concede {against} a game', { for: perGame(goals.scored), against: perGame(goals.conceded) })
                    : t('Scored {for} · Conceded {against}', { for: goals.scored, against: goals.conceded })}</dd></div>}
                <div><dt>{t('Last met')}</dt><dd>{!scout.lastMet ? t('Not in your last 50 matches')
                    : scout.lastMet.result ? <><b data-r={scout.lastMet.result.outcome}>{t(scout.lastMet.result.outcome)} {scout.lastMet.result.scored}–{scout.lastMet.result.conceded}</b> · {shortDate(scout.lastMet.match.startsAt)}</>
                    : <>{scout.lastMet.match.resultStatus === 'PROPOSED' || scout.lastMet.match.resultStatus === 'DISPUTED' ? t('Score to confirm') : t('No result recorded')} · {shortDate(scout.lastMet.match.startsAt)}</>}</dd></div>
            </dl>}
            {theirs && scout && scout.matches.length > 0 && <div className="gk-sb gk-nextop__results">
                <h3 className="gk-sb__head"><span>{t('Their last results')}</span></h3>
                <ul className="gk-sb__rows">{scout.matches.slice(0, results).map(match => <HistoryLine key={match.id} match={match} crestOf={crestOf} mine={team => team.clubId === squad.clubId} />)}</ul>
            </div>}
            {later.length > 0 && <footer className="gk-nextop__then">
                <span>{t('Then')}</span>
                {later.map(({ match, other }) => <Link key={match.id} to={match.detailPath} title={`${fixtureDay(match.startsAt, match.timezone)} · ${other.name}`} aria-label={`${other.name}, ${fixtureDay(match.startsAt, match.timezone)}`}>
                    <Crest src={crestOf(other.clubId)} name={other.club ?? other.name} size={22} round /><small>{fixtureDay(match.startsAt, match.timezone)}</small>
                </Link>)}
            </footer>}
        </article>
    );
}
