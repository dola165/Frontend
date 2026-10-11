import { ButtonLink, EmptyNote } from '../../../../design/primitives';
import { formats, type Match } from '../../../matchExchange/api';
import { plural, useWorldCopy } from '../../copy';
import { codeLabel, fixtureDay, fixtureTime, hoursUntil } from '../../format';
import { useOpponentsForYou, useRefereesForYou } from '../coach/coachExchange';
import { useInvitations, type Invitation } from '../coach/coachMatches';
import { useSquadFocus, type SquadFocus } from '../coach/mySquads';
import { SquadGate } from '../coach/SquadSwitch';
import { WorldField } from '../WorldField';
import { crestsOf, rowsFor, type FieldProps } from './fieldProps';
import { Line, MatchLine, ScoreGroups, WaitTag } from './Scoreboard';

const KIND_ORDER: Record<Invitation['kind'], number> = { reply: 0, offers: 1, open: 2, waiting: 2 };
const arrangeLink = (focus: SquadFocus) => `/world/matches/arrange?mode=open${focus.focus.length === 1 ? `&squad=${focus.focus[0].id}` : ''}`;
const formatLabel = (format: string) => formats[format] ?? codeLabel(format);
/** "6.2 km": short, because "away" means something else on a fixture line. */
const km = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)} km`;

/** A listing's kick-off as a scoreboard time and day. */
const at = (match: Match) => ({ time: fixtureTime(match.starts_at_iso, match.timezone), day: fixtureDay(match.starts_at_iso, match.timezone) });

/**
 * Match invitations as one waiting list: requests to answer first (red within three days), then offers on my
 * squads' open listings, then listings still waiting for an opponent. Answering happens on the match page.
 */
export function InvitationsField({ side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const data = useInvitations(focus);
    const crestOf = crestsOf(markers);
    const items = [...data.items].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    const needYou = items.filter(item => item.kind === 'reply' || item.kind === 'offers').length;
    // 'Nothing to answer' only when every listing's offers were read.
    const unknown = items.some(item => item.kind === 'open');
    const GROUPS = { reply: t('Your reply'), offers: t('Offers for your listings'), open: t('Your open listings'), waiting: t('Your open listings') };
    return (
        <WorldField id="invitations" side={side} count={data.ready ? needYou : null} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={data.ready ? (needYou ? t('{count} need you', { count: needYou }) : unknown ? undefined : t('Nothing to answer')) : undefined}
            all={focus.status === 'ready' ? { label: t('All your arrangements'), to: '/world/matches?tab=mine' } : undefined}>
            <SquadGate focus={focus}>
                {items.length ? <ScoreGroups label={t('Invitations to play')} items={items} group={item => GROUPS[item.kind]}>
                    {({ match, squad, kind, offers, soon }) => {
                        const mine = { name: squad.name, logo: crestOf(squad.clubId), mine: true };
                        const theirs = { name: `${match.club_name} ${match.squad_name}`, logo: match.club_logo_url };
                        return <MatchLine key={`${kind}:${match.event_id}`} to={`/match-exchange/${match.event_id}`} title={match.title} {...at(match)}
                            home={kind === 'reply' ? theirs : mine}
                            away={kind === 'reply' ? mine : { name: kind === 'offers' ? plural(offers, 'offer') : kind === 'open' ? t('Open listing') : match.requested_club_id ? t('Club invited') : t('No offers yet'), muted: true }}
                            tag={kind === 'reply' ? <WaitTag tone={soon ? 'danger' : 'warning'}>{t('Reply')}</WaitTag>
                                : kind === 'offers' ? <WaitTag tone={soon ? 'danger' : 'warning'}>{t('Choose')}</WaitTag>
                                : <WaitTag>{kind === 'open' ? t('See offers') : t('Waiting')}</WaitTag>} />;
                    }}
                </ScoreGroups> : <EmptyNote title={t('No invitations or offers')} action={<ButtonLink size="sm" to={arrangeLink(focus)}>{t('Arrange a match')}</ButtonLink>} />}
            </SquadGate>
        </WorldField>
    );
}

/** Teams of my squads' ages near the area looking for a match: their squad against mine, by day. */
export function OpponentsForYouField({ area, side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const crestOf = crestsOf(markers);
    const data = useOpponentsForYou(area, focus);
    const items = data.items.slice(0, rowsFor(side) + 3);
    return (
        <WorldField id="opponentsForYou" side={side} count={data.data ? data.items.length : null} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={focus.status === 'ready' ? t('{ages} within 50 km', { ages: focus.ages.map(codeLabel).join(', ') }) : undefined}
            all={{ label: t('All open matches'), to: `/world/matches?tab=exchange${focus.ages.length === 1 ? `&ageGroup=${focus.ages[0]}` : ''}` }}>
            <SquadGate focus={focus}>
                {items.length ? <ScoreGroups label={t('Opponents for your squads')} items={items} group={item => fixtureDay(item.match.starts_at_iso, item.match.timezone)}>
                    {({ match, squad, km: distance, busy }) => <MatchLine key={match.event_id} to={`/match-exchange/${match.event_id}`} title={[match.title, match.location_name].filter(Boolean).join(' · ')}
                        time={fixtureTime(match.starts_at_iso, match.timezone)}
                        home={{ name: `${match.club_name} ${match.squad_name}`, logo: match.club_logo_url }} away={{ name: squad.name, logo: crestOf(squad.clubId), mine: true }}
                        tag={busy ? <span data-tone="warning">{t('You play that day')}</span>
                            : [distance != null ? km(distance) : match.city, match.format !== squad.format ? formatLabel(match.format) : codeLabel(match.level)].filter(Boolean).join(' · ')} />}
                </ScoreGroups> : <EmptyNote title={t('No open matches for {ages} near {city}', { ages: focus.ages.map(codeLabel).join(', '), city: area.city })}
                    action={<ButtonLink size="sm" to={arrangeLink(focus)}>{t('Post your own')}</ButtonLink>} />}
            </SquadGate>
        </WorldField>
    );
}

/** My squads' matches still needing a referee, then referees who take those formats: local, volunteers, cheapest first. */
export function RefereesForYouField({ area, side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const data = useRefereesForYou(area, focus);
    const crestOf = crestsOf(markers);
    type Row = { kind: 'match'; match: Match } | { kind: 'referee'; referee: (typeof data.referees)[number] };
    const rows: Row[] = [...data.needing.map(match => ({ kind: 'match' as const, match })), ...data.referees.slice(0, rowsFor(side)).map(referee => ({ kind: 'referee' as const, referee }))];
    return (
        <WorldField id="refereesForYou" side={side} count={data.ready ? data.toAct : null} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={data.ready ? (data.toAct ? t('{count} need a referee', { count: data.toAct }) : data.needing.length ? t('{referees} invited, no answer yet', { referees: plural(data.needing.length, 'referee') }) : t('Every match has a referee')) : undefined}
            all={{ label: t('All referees'), to: '/world/people?role=REFEREE' }}>
            <SquadGate focus={focus}>
                {rows.length ? <ScoreGroups label={t('Referees for your matches')} items={rows} group={row => row.kind === 'match' ? t('Referee not settled') : t('Referees for {formats}', { formats: [...new Set((data.needing.length ? data.needing.map(match => match.format) : focus.formats))].map(formatLabel).join(', ') })}>
                    {row => row.kind === 'match'
                        ? <MatchLine key={`m:${row.match.event_id}`} to={`/match-exchange/${row.match.event_id}`} title={row.match.title} {...at(row.match)}
                            home={{ name: `${row.match.club_name} ${row.match.squad_name}`, logo: row.match.club_logo_url ?? crestOf(row.match.club_id), mine: true }}
                            away={row.match.opponent_name ? { name: [row.match.opponent_name, row.match.opponent_squad_name].filter(Boolean).join(' ') } : { name: t('Opponent wanted'), muted: true }}
                            tag={row.match.referee_status === 'INVITED' ? <WaitTag>{t('Referee invited')}</WaitTag>
                                : <WaitTag tone={row.match.referee_status === 'REPLACEMENT_NEEDED' || (hoursUntil(row.match.starts_at_iso) ?? Infinity) < 72 ? 'danger' : 'warning'}>{row.match.referee_status === 'REPLACEMENT_NEEDED' ? t('Referee withdrew') : t('Find a referee')}</WaitTag>} />
                        : <Line key={`r:${row.referee.user_id}`} to={`/referees/${row.referee.user_id}`} name={row.referee.full_name}
                            detail={[row.referee.formats.split(',').map(value => formatLabel(value.trim())).join(', '), row.referee.service_area].filter(Boolean).join(' · ')}
                            fact={!row.referee.accepts_paid ? t('Volunteer') : row.referee.accepts_volunteer ? t('Volunteer or {fee}', { fee: `${row.referee.fee} ${row.referee.currency}` }) : `${row.referee.fee} ${row.referee.currency}`}
                            factTone={row.referee.accepts_volunteer ? 'accent' : undefined} />}
                </ScoreGroups> : <EmptyNote title={t('No referees listed for your formats')} />}
            </SquadGate>
        </WorldField>
    );
}
