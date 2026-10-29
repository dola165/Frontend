import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { Button, EmptyNote, List, ListRow, LoadFailed, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { useAuth } from '../../../context/AuthContext';
import { getMatchHistory, type HistoryMatch } from '../../matchHistory/api';
import { ArrangeMatchForm } from '../../matchExchange/arrange/ArrangeMatchForm';
import { arrangeDraftKey } from '../../world/compose/arrangeSeed';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { mySquadsEn } from '../../../locales/mySquadsDesign';
import { useCopy } from '../../../locales/useCopy';
import { dayLabel, timeLabel } from '../fixtures';
import { ActivityBadge, SquadSwitch } from './CoachVisuals';
import { Status } from '../../../design/DataTable';
import { ScoreDialog } from '../../scores/ScoreDialog';
import { isOfficial, isOpen, scoreState } from '../../scores/status';
import { useResultCopy } from '../../matchHistory/copy';
import { NextMatchCard } from './NextMatchCard';
import { useFirstAllowed } from '../../../hooks/useCan';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

const friendly = (match: HistoryMatch) => /friendly/i.test(match.title) ? 'FRIENDLY' : 'MATCH';
const waitingKeys: Record<string, 'waitingOpponent' | 'openToAnyClub' | 'cancelled'> = { PENDING: 'waitingOpponent', PROPOSED: 'waitingOpponent', INVITED: 'waitingOpponent', OPEN: 'openToAnyClub', CANCELLED: 'cancelled' };

/**
 * My squads' matches, all on this page: the next match card on top (the same card for everyone on the squad, step 3),
 * arrange one in a dialog (the same form as World and the club page, already on this squad), what is coming up, and
 * what was played with the score, or its open score step (report, confirm or dispute, settle) in the same score dialog
 * as everywhere.
 */
export function CoachMatches({ data }: { data: CoachData }) {
    const copy = useCopy('coachHub', coachHubEn);
    const words = useCopy('mySquads', mySquadsEn);
    const { copy: result } = useResultCopy();
    const { user, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const [page, setPage] = useState<{ key: string; items: HistoryMatch[]; error: string } | null>(null);
    const [adding, setAdding] = useState<HistoryMatch | null>(null);
    const [revision, setRevision] = useState(0);
    const arranging = params.get('arrange') === '1';
    const key = `${sessionId}:${revision}`;
    useEffect(() => {
        const controller = new AbortController();
        getMatchHistory('period=ALL&mine=true&size=100', controller.signal, sessionId)
            .then(result => { if (!controller.signal.aborted) setPage({ key, items: result.items, error: '' }); })
            .catch(cause => { if (!controller.signal.aborted) setPage({ key, items: [], error: extractApiErrorMessage(cause, 'failed') }); });
        return () => controller.abort();
    }, [key, sessionId]);
    // The server's own words when it gave some; otherwise ours, in the person's language.
    const error = page?.key === key && page.error ? (page.error === 'failed' ? copy('matchesLoadError') : page.error) : '';

    const squadNames = data.shown.map(id => (data.names.get(id) ?? '').toLowerCase()).filter(Boolean);
    const mineMatch = (match: HistoryMatch) => data.shown.includes(match.homeSquadId ?? -1) || data.shown.includes(match.awaySquadId ?? -1)
        || squadNames.some(name => [match.homeSquadName, match.awaySquadName, match.title].some(text => text?.toLowerCase().includes(name)));
    const squadOf = (match: HistoryMatch) => data.names.get(match.homeSquadId ?? -1) ?? data.names.get(match.awaySquadId ?? -1) ?? match.homeSquadName ?? match.awaySquadName ?? '';
    const items = page?.key === key ? page.items.filter(mineMatch) : null;
    const time = (match: HistoryMatch) => match.startsAt ? new Date(match.startsAt).getTime() : 0;
    const nextCards = data.shown.map(id => data.cards?.get(id)).filter(card => card?.match)
        .sort((a, b) => a!.match!.starts_at_iso.localeCompare(b!.match!.starts_at_iso));
    const cardsFailed = data.shown.some(id => data.cardsFailed.includes(id));
    // The next match has its card on top, so Coming up leaves it out: the same fixture is never shown twice.
    const carded = (match: HistoryMatch) => nextCards.some(card => match.detailPath === `/match-exchange/${card!.match!.event_id}`
        || ([match.homeSquadId, match.awaySquadId].includes(card!.squadId) && Math.abs(time(match) - new Date(card!.match!.starts_at_iso).getTime()) < 60_000));
    const upcoming = (items ?? []).filter(match => time(match) >= data.now && match.fixtureStatus !== 'CANCELLED' && !carded(match)).sort((a, b) => time(a) - time(b));
    const played = (items ?? []).filter(match => time(match) < data.now).sort((a, b) => time(b) - time(a));
    // Arranging is match management (head coaches, team managers) on any squad shown; everyone on the squad reads its
    // matches. The form opens only once that answer is in, on the first squad shown where this person arranges matches
    // (the one picked in the switcher), so it never opens on one squad's draft and then moves to another.
    const arranger = useFirstAllowed(data.shown.map(id => `squad:${id}` as const), 'arrange_match');
    const squadForMatch = arranger.subject ? Number(arranger.subject.split(':')[1]) : null;
    const canArrange = squadForMatch !== null;
    // "+ Arrange a match" anywhere opens the form in a dialog here; `arrange=1` in the address does the same on arrival.
    const setArranging = (open: boolean) => { const next = new URLSearchParams(params); if (open) next.set('arrange', '1'); else next.delete('arrange'); setParams(next, { replace: !open }); };

    const row = (match: HistoryMatch, past: boolean) => {
        const when = match.startsAt ? `${dayLabel(match.startsAt, data.now)} ${timeLabel(match.startsAt)}` : copy('dateToAgree');
        const scored = match.homeScore != null && match.awayScore != null && (isOfficial(match.resultStatus) || match.resultStatus === 'LEGACY' || match.legacy);
        // An open score step (no report yet, or one reported or disputed) opens the score here; the server says whose.
        // Tournament scores are the organiser's, in the tournament's own workspace.
        const needsResult = past && match.canRecordResult && match.source !== 'TOURNAMENT' && (match.resultStatus === 'NONE' || isOpen(match.resultStatus));
        const state = scoreState(match.resultStatus);
        const waiting = !past && waitingKeys[match.fixtureStatus] && copy(waitingKeys[match.fixtureStatus]);
        // Our own club is a given here: the row names the opponent, home or away and the time, and the score reads ours first.
        const home = match.homeClubId === data.clubId, away = !home && match.awayClubId === data.clubId;
        const opponent = home ? match.awayClubName : away ? match.homeClubName : null;
        const ours = away ? [match.awayScore, match.homeScore] : [match.homeScore, match.awayScore];
        const meta = [when, home ? copy('homeGame') : away ? copy('awayGame') : null, data.shown.length > 1 ? squadOf(match) : null,
            opponent && match.source === 'TOURNAMENT' ? match.tournamentName ?? match.title : null, match.locationName];
        return <ListRow key={match.id} to={needsResult ? undefined : match.detailPath} onClick={needsResult ? () => setAdding(match) : undefined}
            lead={<ActivityBadge kind={friendly(match)} size={32} />} title={opponent ? copy('versus', { team: opponent }) : match.title} meta={meta.filter(Boolean).join(' · ')}
            trail={<>{scored ? <strong className="ch-result">{ours[0]}–{ours[1]}</strong>
                : needsResult ? <Status tone={state.tone}>{match.resultStatus === 'NONE' ? copy('addResult') : result(...state.words)}</Status>
                    : waiting ? <span className={`cw-status cw-status--${match.fixtureStatus === 'CANCELLED' ? 'danger' : 'warning'}`}>{waiting}</span>
                        : past ? <Status tone={isOfficial(match.resultStatus) ? 'accent' : 'neutral'}>{match.resultStatus === 'NONE' ? copy('noScore') : result(...state.words)}</Status> : null}<ChevronRight className="cw-chevron" aria-hidden="true" /></>} />;
    };
    const loading = items === null;

    return <PageFrame className="cw-page ch-page">
        <PageHeader title={copy('matches')} actions={canArrange ? <Button variant="primary" onClick={() => setArranging(true)}><Plus aria-hidden="true" />{copy('arrangeMatch')}</Button> : undefined} />
        <SquadSwitch data={data} />
        {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        {nextCards.map(card => <NextMatchCard key={card!.squadId} card={card!} data={data} onChanged={data.refresh} />)}
        {cardsFailed && <LoadFailed text={`${words('nextMatch')} · ${words('couldntLoad')}`} retry={words('tryAgain')} onRetry={data.retryCards} />}
        <div className="gk-stack">
            <Section boxed title={copy('comingUp')} hint={upcoming.length ? `${upcoming.length}` : undefined}>
                <Panel flush>{loading ? <div className="cw-skeleton-rows" role="status" aria-label={copy('comingUp')}>{[0, 1].map(i => <Skeleton key={i} height={48} />)}</div>
                    : upcoming.length ? <List label={copy('comingUp')}>{upcoming.map(match => row(match, false))}</List>
                        : <EmptyNote title={copy('noMatchesSoon')} action={canArrange ? <Button size="sm" onClick={() => setArranging(true)}>+ {copy('arrangeMatch')}</Button> : undefined}>{copy('noMatchesSoonHint')}</EmptyNote>}</Panel>
            </Section>
            {/* One green-edged box between what is coming and what was played: the question, and the one button. */}
            {canArrange && <div className="ch-arrange-box">
                <span className="ch-arrange-box__ask">{copy('arrangeAsk')}</span>
                <Button variant="primary" onClick={() => setArranging(true)}><Plus aria-hidden="true" />{copy('arrangeMatch')}</Button>
            </div>}
            <Section boxed title={copy('played')} hint={played.length ? `${played.length}` : undefined}>
                <Panel flush>{loading ? <div className="cw-skeleton-rows" role="status" aria-label={copy('played')}>{[0, 1, 2].map(i => <Skeleton key={i} height={48} />)}</div>
                    : played.length ? <List label={copy('played')}>{played.map(match => row(match, true))}</List>
                        : <EmptyNote title={copy('noMatchesPlayed')}>{copy('noMatchesPlayedHint')}</EmptyNote>}</Panel>
            </Section>
        </div>
        {arranging && user && squadForMatch !== null && <Dialog open size="lg" title={copy('arrangeMatch')} description={data.names.get(squadForMatch)} onClose={() => setArranging(false)}>
            <div className="ch-arrange"><ArrangeMatchForm key={squadForMatch} mode="direct" squadId={squadForMatch} storageKey={arrangeDraftKey(user.id, sessionId, `coach-${squadForMatch}`)}
                onSent={() => { setArranging(false); setRevision(value => value + 1); data.refresh(); }} /></div>
        </Dialog>}
        {adding && <ScoreDialog target={{ kind: adding.source === 'MATCH_EXCHANGE' ? 'EXCHANGE' : 'CALENDAR', eventId: adding.sourceId }} title={adding.title}
            teams={{ home: { name: adding.homeClubName ?? '', logo: adding.homeClubId === data.clubId ? data.clubLogo : null, clubId: adding.homeClubId }, away: { name: adding.awayClubName ?? '', logo: adding.awayClubId === data.clubId ? data.clubLogo : null, clubId: adding.awayClubId } }}
            description={adding.startsAt ? `${adding.title} · ${dayLabel(adding.startsAt, data.now)} ${timeLabel(adding.startsAt)}` : adding.title}
            onClose={() => setAdding(null)} onChanged={() => { setRevision(value => value + 1); data.refresh(); }} />}
    </PageFrame>;
}
