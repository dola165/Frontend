import { ButtonLink, EmptyNote } from '../../../../design/primitives';
import type { CompetitionCard } from '../../../competitions/api';
import { anyOf, useWorldCopy } from '../../copy';
import { codeLabel, daysUntil, fixtureDay, fixtureTime, shortDate } from '../../format';
import { useAgeTrials, useCompetitionResults, useCompetitionsForYou, useMyCompetitions, type MyCompetition } from '../coach/coachCompetitions';
import { HistoryLine, type CrestOf } from '../../scoreboard/HistoryLine';
import { CupPath, MiniTable } from '../../scoreboard/MiniTable';
import { useSquadFocus } from '../coach/mySquads';
import { zoned } from '../../scoreboard/standings';
import { SquadGate } from '../coach/SquadSwitch';
import { ROLE_GROUP, byRole } from '../coach/relevance';
import { WorldField } from '../WorldField';
import { crestsOf, rowsFor, type FieldProps } from './fieldProps';
import { Line, MatchLine, ScoreGroups, WaitTag } from '../../scoreboard/Scoreboard';
import '../coach/coach.css';

const closesAt = (card: CompetitionCard) => (card as CompetitionCard & { registrationClosesAt?: string | null }).registrationClosesAt;

/** One competition of mine: its table, cup run or festival day, then my next match in it. */
function MyCompetitionBlock({ item, crestOf }: { item: MyCompetition; crestOf: CrestOf }) {
    const t = useWorldCopy();
    const { detail, view, next, squads, entries } = item;
    const mine = new Set(entries.map(entry => entry.id));
    const clubOf = new Map(detail.entries.map(entry => [entry.id, entry.clubId]));
    const fixtures = detail.fixtures.filter(fixture => fixture.status !== 'CANCELLED' && (mine.has(fixture.homeEntryId ?? -1) || mine.has(fixture.awayEntryId ?? -1)));
    const who = squads.length ? squads.map(squad => squad.name).join(', ') : t('Whole club');
    const label = `${detail.name}, ${who}`;
    // A festival's day is its first match of mine: the listed start date can differ from the schedule.
    const firstDay = fixtures.map(fixture => fixture.scheduledAt).filter(Boolean).sort()[0] ?? null;
    return (
        <section className="gk-mycomp" aria-label={label}>
            <h3 className="gk-sb__head"><span>{detail.name}</span><small>{who}</small></h3>
            <div className="gk-mycomp__body">
                {view.kind === 'table' && (view.rows.length ? <MiniTable rows={view.rows} through={view.stage.advanceCount} label={t('{name} table', { name: detail.name })} /> : <p className="gk-mycomp__note">{t('No table yet')}</p>)}
                {view.kind === 'cup' && <>
                    <CupPath steps={view.steps} label={t('{name} run', { name: detail.name })} />
                    {view.eliminated && <p className="gk-mycomp__note">{t('Out of the cup')}</p>}
                </>}
                {view.kind === 'festival' && <p className="gk-mycomp__note">{fixtures.length ? t('{count} matches, from {day}', { count: fixtures.length, day: fixtureDay(zoned(firstDay)) }) : t('Starts {date}', { date: shortDate(detail.startDate) ?? t('date to confirm') })}</p>}
            </div>
            {next && <ul className="gk-sb__rows">
                <MatchLine to={`/tournaments/${detail.id}?fixtureId=${next.id}`} title={[next.homeLabel, next.awayLabel].join(' vs ')}
                    time={fixtureTime(zoned(next.scheduledAt))} day={fixtureDay(zoned(next.scheduledAt))}
                    home={{ name: next.homeLabel ?? t('To be decided'), logo: crestOf(clubOf.get(next.homeEntryId ?? -1) ?? null), mine: mine.has(next.homeEntryId ?? -1), muted: !next.homeEntryId }}
                    away={{ name: next.awayLabel ?? t('To be decided'), logo: crestOf(clubOf.get(next.awayEntryId ?? -1) ?? null), mine: mine.has(next.awayEntryId ?? -1), muted: !next.awayEntryId }}
                    tag={t('Next')} />
            </ul>}
        </section>
    );
}

/** The leagues and cups my squads play: the table around my row, the cup run, and the next match in each. */
export function MyCompetitionsField({ side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const data = useMyCompetitions(focus);
    const crestOf = crestsOf(markers);
    const items = data.data ?? [];
    return (
        <WorldField id="myCompetitions" side={side} count={data.data ? items.length : null} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={items.length ? items.map(item => item.detail.name).slice(0, 2).join(' · ') : undefined}
            all={{ label: t('All competitions'), to: '/world/competitions' }}>
            <SquadGate focus={focus}>
                {items.length ? <div className="gk-sb">{items.map(item => <MyCompetitionBlock key={item.detail.id} item={item} crestOf={crestOf} />)}</div>
                    : <EmptyNote title={t('Your squads are not in a competition')} action={<ButtonLink size="sm" to="/world/competitions?registration=OPEN">{t('Find one to enter')}</ButtonLink>} />}
            </SquadGate>
        </WorldField>
    );
}

/** Every recorded score in my squads' competitions, under the competition, my team starred. */
export function CompetitionResultsField({ side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const data = useCompetitionResults(focus);
    const crestOf = crestsOf(markers);
    const ids = new Set(focus.focus.map(squad => squad.id));
    const rows = (data.data ?? []).flatMap(entry => entry.matches.slice(0, rowsFor(side)).map(match => ({ match, name: entry.competition.detail.name })));
    const found = (data.data ?? []).reduce((sum, entry) => sum + entry.matches.length, 0);
    return (
        <WorldField id="competitionResults" side={side} count={data.data ? found : null} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={rows[0] ? shortDate(rows[0].match.startsAt) ?? undefined : undefined} all={{ label: t('All results'), to: '/world/matches?tab=fixtures&period=HISTORY' }}>
            <SquadGate focus={focus}>
                {rows.length ? <ScoreGroups label={t('Results in your competitions')} items={rows} group={row => row.name}>
                    {row => <HistoryLine key={row.match.id} match={row.match} crestOf={crestOf} mine={team => team.squadId != null && ids.has(team.squadId)} />}
                </ScoreGroups> : <EmptyNote title={t('No results in your competitions yet')} />}
            </SquadGate>
        </WorldField>
    );
}

/** Competitions my squads can still enter, with invitations first, and when entries close. */
export function CompetitionsForYouField({ side, role }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const data = useCompetitionsForYou(focus);
    const items = data.data?.items ?? [], invitations = data.data?.invitations ?? [];
    type Row = { kind: 'invited'; invitation: (typeof invitations)[number] } | { kind: 'open'; item: (typeof items)[number] };
    const rows: Row[] = [...invitations.map(invitation => ({ kind: 'invited' as const, invitation })), ...items.slice(0, rowsFor(side)).map(item => ({ kind: 'open' as const, item }))];
    const who = anyOf(focus.focus.map(squad => squad.name));
    return (
        <WorldField id="competitionsForYou" side={side} count={data.data ? invitations.length + items.length : null} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={invitations.length ? t('{count} invitations', { count: invitations.length }) : focus.status === 'ready' ? who : undefined}
            all={{ label: t('All open competitions'), to: '/world/competitions?registration=OPEN' }}>
            <SquadGate focus={focus}>
                {rows.length ? <ScoreGroups label={t('Competitions for your age groups')} items={rows} group={row => row.kind === 'invited' ? t('Invited') : t('Open for entries')}>
                    {row => row.kind === 'invited'
                        ? <Line key={`i:${row.invitation.invitationId}`} to={`/tournaments/${row.invitation.tournamentId}`} name={row.invitation.tournamentName}
                            detail={[row.invitation.squadName, codeLabel(row.invitation.tournamentStatus)].filter(Boolean).join(' · ')} fact={<WaitTag tone="warning">{t('Reply')}</WaitTag>} />
                        : (() => {
                            const { card, squads } = row.item, rules = card.profile?.rules, left = daysUntil(closesAt(card));
                            return <Line key={`o:${card.id}`} to={`/tournaments/${card.id}`} crest={card.bannerImageUrl} name={card.name}
                                detail={[focus.focus.length > 1 ? squads.map(squad => squad.name).join(', ') : null, rules && `${rules.sideSize}v${rules.sideSize}`, rules?.city, card.hostClubName || card.organizerName].filter(Boolean).join(' · ')}
                                fact={left != null && left >= 0 ? t('Closes {date}', { date: shortDate(closesAt(card)) ?? '' }) : shortDate(card.startDate)} factTone={left != null && left >= 0 && left <= 7 ? 'warning' : undefined} />;
                        })()}
                </ScoreGroups> : <EmptyNote title={t('Nothing open for {who} right now', { who })}
                    action={data.data?.total ? <ButtonLink size="sm" to="/world/competitions?registration=OPEN">{t('All open competitions ({count})', { count: data.data.total })}</ButtonLink> : undefined} />}
            </SquadGate>
        </WorldField>
    );
}

/** Other clubs' trials for the ages I coach: who else is looking for players like mine. */
export function AgeTrialsField({ side, role }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const data = useAgeTrials(focus, role);
    const items = data.items.slice(0, rowsFor(side));
    // What suits the role (keepers for a goalkeeper coach) comes first under its own heading, the rest by day.
    const suits = (trial: (typeof items)[number]) => Boolean(ROLE_GROUP[role]) && byRole(role, [trial.title, trial.position].filter(Boolean).join(' ')) === 0;
    return (
        <WorldField id="ageTrials" side={side} count={data.data ? data.items.length : null} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={focus.status === 'ready' ? focus.ages.map(codeLabel).join(', ') : undefined} all={{ label: t('All trials'), to: '/world/opportunities?tab=trials' }}>
            <SquadGate focus={focus}>
                {items.length ? <ScoreGroups label={t('Trials in your age groups')} items={items}
                    group={trial => suits(trial) ? t(ROLE_GROUP[role]!) : fixtureDay(trial.tryoutDate)}>
                    {trial => <Line key={trial.id} to={`/tryouts/${trial.id}`} when={{ time: fixtureTime(trial.tryoutDate), day: suits(trial) ? fixtureDay(trial.tryoutDate) : undefined }} name={trial.title}
                        detail={[trial.clubName, codeLabel(trial.position), trial.location].filter(Boolean).join(' · ')} fact={codeLabel(trial.ageGroup)} />}
                </ScoreGroups> : <EmptyNote title={t('No other club has a trial for {ages} open', { ages: anyOf(focus.ages.map(codeLabel)) })} />}
            </SquadGate>
        </WorldField>
    );
}
