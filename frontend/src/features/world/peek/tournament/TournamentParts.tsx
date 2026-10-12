import { Link } from 'react-router-dom';
import { ChevronRight, Star } from 'lucide-react';
import { Status } from '../../../../design/DataTable';
import type { BadgeTone } from '../../../../design/primitives';
import type { TournamentEntryDto } from '../../../tournaments/domain';
import { instantEntry } from '../../../tournaments/entryGates';
import { FORMAT_WORD, roundName } from '../../../tournaments/shape/shapeOf';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { codeLabel, SCOPE_LABEL, shortDate } from '../../format';
import { HistoryLine } from '../../scoreboard/HistoryLine';
import { zoned } from '../../scoreboard/standings';
import { feeLabel, lastEntryDay } from '../../directories/tournaments/tournamentItem';
import { fixtureMatch, mineSideOf, sideName, visibleEntries, type TournamentPaneData } from './tournamentPane';

/** Fixtures under their stage and round ("Cup · Semi-finals"), else by stage; each opens its match stacked over the pane. */
export function TournamentMatches({ data, open }: { data: TournamentPaneData; open: (value: string) => void }) {
    const t = useWorldCopy();
    const { detail } = data;
    const mineSide = mineSideOf(data);
    const fixtures = detail.fixtures.filter(fixture => fixture.status !== 'CANCELLED' && (fixture.homeEntryId != null || fixture.awayEntryId != null || fixture.scheduledAt));
    const groups = new Map<string, typeof fixtures>();
    // A two-legged tie is one tie: its first leg is left out when a round is named by its ties, as in the bracket.
    const firstLegs = new Set((data.draw?.aggregates ?? []).map(tie => tie.first_fixture_id));
    for (const fixture of fixtures) {
        const stage = detail.stages.find(item => item.id === fixture.stageId);
        const ties = stage?.stageType === 'KNOCKOUT' ? new Set(fixtures.filter(other => other.stageId === stage.id && other.roundNumber === fixture.roundNumber && !firstLegs.has(other.id)).map(other => other.id)).size : 0;
        const round = stage?.stageType === 'KNOCKOUT' ? t(roundName(ties), { n: fixture.roundNumber ?? 1 }) : t('Round {n}', { n: fixture.roundNumber ?? 1 });
        const key = [detail.stages.length > 1 ? stage?.name : null, round].filter(Boolean).join(' · ');
        groups.set(key, [...(groups.get(key) ?? []), fixture]);
    }
    const all = `/world/matches?tab=fixtures&source=TOURNAMENT&tournamentId=${detail.id}`;
    return <>
        {fixtures.length ? [...groups].map(([name, rows]) => (
            <section key={name} className="gk-tpane-round">
                <h4>{name}</h4>
                <ul className="gk-sb__rows">{rows.map(fixture => {
                    const { match, code } = fixtureMatch(detail, fixture, data.canManage);
                    return <HistoryLine key={fixture.id} match={match} crestOf={() => null} mine={mineSide} peek={`match-${code}`} open={open} />;
                })}</ul>
            </section>
        )) : <p className="gk-faint">{t('The matches appear once the draw is made.')}</p>}
        <Link className="gk-pane-more" to={all}>{t('All fixtures in Matches')}<ChevronRight aria-hidden="true" /></Link>
    </>;
}

/** How an entry stands, in words: in, waiting for the organiser, on the waiting list, out, the champion. */
function entryState(entry: TournamentEntryDto, championId?: number | null): { label: string; tone: BadgeTone } {
    if (championId === entry.id) return { label: 'Champion', tone: 'accent' };
    switch (entry.status) {
        case 'PENDING': return { label: 'Waiting for the organiser', tone: 'warning' };
        case 'WAITLISTED': return { label: 'On the waiting list', tone: 'warning' };
        case 'ELIMINATED': return { label: 'Out', tone: 'neutral' };
        case 'COMPLETED': return { label: 'Finished', tone: 'neutral' };
        default: return { label: 'In', tone: 'accent' };
    }
}

/** The teams entered: crest, club, squad, how each stands; mine first and starred. Entries still waiting show only to the organiser and the entrant. */
export function TournamentTeams({ data }: { data: TournamentPaneData }) {
    const t = useWorldCopy();
    const entries = [...visibleEntries(data)].sort((a, b) => Number(data.mine.has(b.id)) - Number(data.mine.has(a.id)) || (a.seed ?? 999) - (b.seed ?? 999));
    if (!entries.length) return <p className="gk-faint">{t('No teams have entered yet.')}</p>;
    return (
        <ul className="gk-tpane-teams">{entries.map(entry => {
            const name = sideName(entry) ?? t('Private participant'), state = entryState(entry, data.detail.championEntryId);
            return (
                <li key={entry.id} data-mine={data.mine.has(entry.id) || undefined}>
                    <Crest name={name} size={28} round />
                    <span className="gk-pane-line">
                        {entry.clubId ? <Link to={`/clubs/${entry.clubId}`}>{name}</Link> : <b>{name}</b>}
                        <small>{data.mine.has(entry.id) && <Star aria-label={t('Your team')} />}{entry.squadName}</small>
                    </span>
                    <Status tone={state.tone}>{t(state.label)}</Status>
                </li>
            );
        })}</ul>
    );
}

const TIEBREAK: Record<string, string> = { POINTS: 'Points', GOAL_DIFFERENCE: 'Goal difference', GOALS_FOR: 'Goals scored', WINS: 'Wins', BUCHHOLZ: 'Opponents’ points', SEED: 'Seeding' };

/** What the organiser published: the description, dates from real times only, how entries work, the fee and prizes, the rules. */
export function TournamentAbout({ data }: { data: TournamentPaneData }) {
    const t = useWorldCopy();
    const { detail, rules } = data;
    const day = (value?: string | null) => shortDate(zoned(value));
    const facts: [string, string | null | undefined][] = [
        ['Format', rules ? t(FORMAT_WORD[rules.structure]) : null],
        ['Who it is for', rules ? [codeLabel(rules.ageGroup), rules.eligibilityCategory, `${rules.sideSize}v${rules.sideSize}`, codeLabel(rules.playingLevel)].filter(Boolean).join(' · ') : null],
        ['Who enters', SCOPE_LABEL[detail.participantScope] ? t(SCOPE_LABEL[detail.participantScope]) : null],
        ['Dates', [day(detail.startDate), day(detail.endDate)].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' – ') || null],
        ['Entries', [detail.registrationOpensAt && t('open {date}', { date: day(detail.registrationOpensAt) ?? '' }), detail.registrationClosesAt && t('last day {date}', { date: lastEntryDay(detail.registrationClosesAt) ?? '' })].filter(Boolean).join(', ') || null],
        ['How entries work', [detail.registrationPolicy === 'INVITE_ONLY' ? t('By invitation only.') : instantEntry(detail, rules) ? t('Entries are accepted as they come.') : t('The organiser approves each entry.'), detail.entryCap ? t('{cap} places; once full, entries join the waiting list.', { cap: detail.entryCap }) : null].filter(Boolean).join(' ') || null],
        ['Entry fee', rules ? [feeLabel(rules), rules.entryFee ? t('paid to the organiser') : null].filter(Boolean).join(', ') : null],
        ['Prizes', detail.incentives],
        ['Matches', rules ? t('{minutes} minutes, {rest} minutes between', { minutes: rules.matchMinutes, rest: rules.restMinutes }) : null],
        ['Level on points', rules?.tiebreaks.length ? rules.tiebreaks.map(key => t(TIEBREAK[key] ?? key)).join(' › ') : null],
        ['Rules', rules?.ruleset || detail.rules],
    ];
    return <>
        {detail.description && <p className="gk-peek-about">{detail.description}</p>}
        <dl className="gk-tpane-facts">{facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
    </>;
}
