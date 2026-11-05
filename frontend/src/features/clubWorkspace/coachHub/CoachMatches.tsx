import { useEffect, useState } from 'react';
import { ChevronRight, History, Trophy } from 'lucide-react';
import { Button, EmptyNote, List, ListRow, LoadFailed, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { useAuth } from '../../../context/AuthContext';
import { useFirstAllowed } from '../../../hooks/useCan';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { mySquadsEn } from '../../../locales/mySquadsDesign';
import { useCopy } from '../../../locales/useCopy';
import { ActionButton } from '../../actions/ActionButton';
import { ResultsWaitingList } from '../../actions/ResultsWaitingList';
import { useResultsWaiting } from '../../actions/useResultsWaiting';
import type { Match } from '../../matchExchange/api';
import { windowOf } from '../../matchExchange/detail/matchState';
import { getMatchHistory, type HistoryMatch } from '../../matchHistory/api';
import { useResultCopy } from '../../matchHistory/copy';
import { matchPath } from '../../matches/matchContext';
import { isOfficial, isOpen, scoreState } from '../../scores/status';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { fetchMatchListings } from '../../world/api';
import { dayLabel, timeLabel } from '../fixtures';
import { ActivityBadge, SquadSwitch } from './CoachVisuals';
import { NextMatchCard } from './NextMatchCard';
import { PastMatchDialog } from './PastMatchDialog';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

const friendly = (match: HistoryMatch) => /friendly/i.test(match.title) ? 'FRIENDLY' : 'MATCH';
type Loaded = { key: string; items: HistoryMatch[]; open: Match[]; error: string; openFailed: boolean };

/**
 * Every match of ours still to answer (open challenges, invitations, matches another club added), page by page:
 * however long our history is, none hides behind it (fix round 1).
 */
async function stillToAnswer(signal: AbortSignal): Promise<Match[]> {
    const items: Match[] = [];
    for (let page = 0; page < 20; page++) {
        const next = await fetchMatchListings(new URLSearchParams({ mine: 'true', active: 'true', page: String(page) }), signal);
        items.push(...next.items);
        if (!next.items.length || items.length >= next.total) break;
    }
    return items;
}

/**
 * My squads › Matches, the club's match work for the squads shown (step 6): the next match card on top, the results
 * waiting on us, what is coming up, our open challenges and invitations (and those sent to us), and what was played.
 * Every row opens the one match page in this squad's context. Arranging is the one sheet; "Add a past match" records
 * one already played. World keeps discovery only.
 */
export function CoachMatches({ data }: { data: CoachData }) {
    const copy = useCopy('coachHub', coachHubEn);
    const words = useCopy('mySquads', mySquadsEn);
    const say = useJourneyCopy();
    const { copy: result } = useResultCopy();
    const { sessionId } = useAuth();
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [adding, setAdding] = useState(false);
    const [notice, setNotice] = useState('');
    const [revision, setRevision] = useState(0);
    const waiting = useResultsWaiting();
    const key = `${sessionId}:${revision}`;
    useEffect(() => {
        const controller = new AbortController();
        // A list that can't load says so, with a retry: never "nothing to answer" (fix round 1).
        Promise.all([getMatchHistory('period=ALL&mine=true&size=100', controller.signal, sessionId),
            stillToAnswer(controller.signal).then(open => ({ open, failed: false }), () => ({ open: [] as Match[], failed: true }))])
            .then(([history, listings]) => { if (!controller.signal.aborted) setLoaded({ key, items: history.items, open: listings.open, error: '', openFailed: listings.failed }); })
            .catch(cause => { if (!controller.signal.aborted) setLoaded({ key, items: [], open: [], error: extractApiErrorMessage(cause, 'failed'), openFailed: false }); });
        return () => controller.abort();
    }, [key, sessionId]);
    // The server's own words when it gave some; otherwise ours, in the person's language.
    const error = loaded?.key === key && loaded.error ? (loaded.error === 'failed' ? copy('matchesLoadError') : loaded.error) : '';

    const squadNames = data.shown.map(id => (data.names.get(id) ?? '').toLowerCase()).filter(Boolean);
    const ourSquad = (match: HistoryMatch) => [match.homeSquadId, match.awaySquadId].find(id => id != null && data.shown.includes(id)) ?? null;
    const mineMatch = (match: HistoryMatch) => ourSquad(match) != null
        || squadNames.some(name => [match.homeSquadName, match.awaySquadName, match.title].some(text => text?.toLowerCase().includes(name)));
    const squadOf = (match: HistoryMatch) => data.names.get(ourSquad(match) ?? -1) ?? match.homeSquadName ?? match.awaySquadName ?? '';
    const items = loaded?.key === key ? loaded.items.filter(mineMatch) : null;
    const time = (match: HistoryMatch) => match.startsAt ? new Date(match.startsAt).getTime() : 0;
    const nextCards = data.shown.map(id => data.cards?.get(id)).filter(card => card?.match)
        .sort((a, b) => a!.match!.starts_at_iso.localeCompare(b!.match!.starts_at_iso));
    const cardsFailed = data.shown.some(id => data.cardsFailed.includes(id));
    // The next match has its card on top, so Coming up leaves it out: the same fixture is never shown twice.
    const carded = (match: HistoryMatch) => nextCards.some(card => (match.source === 'MATCH_EXCHANGE' && match.sourceId === card!.match!.event_id)
        || ([match.homeSquadId, match.awaySquadId].includes(card!.squadId) && Math.abs(time(match) - new Date(card!.match!.starts_at_iso).getTime()) < 60_000));
    const upcoming = (items ?? []).filter(match => time(match) >= data.now && match.fixtureStatus !== 'CANCELLED' && !carded(match)).sort((a, b) => time(a) - time(b));
    const played = (items ?? []).filter(match => time(match) < data.now).sort((a, b) => time(b) - time(a));
    // Still open: our open challenges and invitations sent; invitations to one of our squads and matches another club
    // added against ours, both waiting for our answer (first).
    const ours = (m: Match) => m.club_id === data.clubId && data.shown.includes(m.squad_id);
    const asked = (m: Match) => m.opponent_answer === 'WAITING' && m.opponent_asked_club === data.clubId;
    const answer = (m: Match) => Boolean(m.can_respond) || asked(m);
    const open = (loaded?.key === key ? loaded.open : []).filter(m => Date.parse(m.ends_at_iso) > data.now && (asked(m)
        || m.listing_status === 'OPEN' && (ours(m) || (m.can_respond && (!m.requested_squad_id || data.shown.includes(m.requested_squad_id))))))
        .sort((a, b) => Number(answer(b)) - Number(answer(a)) || a.starts_at_iso.localeCompare(b.starts_at_iso));
    const scoresWaiting = (waiting ?? []).some(item => item.squadId != null && data.shown.includes(item.squadId));
    // Arranging is match management (head coaches, team managers, head of coaching, admins): the squad picked, else the
    // first shown where this person arranges matches. Everyone on the squad reads its matches.
    const arranger = useFirstAllowed(data.shown.map(id => `squad:${id}` as const), 'arrange_match');
    const squadForMatch = arranger.subject ? Number(arranger.subject.split(':')[1]) : null;
    const arrange = (variant: 'primary' | 'secondary' = 'primary') => squadForMatch !== null
        ? <ActionButton action="arrange_match" firstTip="arrange-match" variant={variant} subject={{ kind: 'squad', id: squadForMatch, clubId: data.clubId }} /> : null;

    const page = (match: HistoryMatch, hash = '') => {
        const squad = ourSquad(match);
        return match.source === 'MATCH_EXCHANGE' ? matchPath(match.sourceId, squad ? { kind: 'squad', id: squad } : null, hash) : match.detailPath;
    };
    const row = (match: HistoryMatch, past: boolean) => {
        const when = match.startsAt ? `${dayLabel(match.startsAt, data.now)} ${timeLabel(match.startsAt)}` : copy('dateToAgree');
        const scored = match.homeScore != null && match.awayScore != null && (isOfficial(match.resultStatus) || match.resultStatus === 'LEGACY' || match.legacy);
        // A score still open (none yet, or reported or disputed) says so; the result waits on the match page.
        const needsResult = past && match.canRecordResult && match.source !== 'TOURNAMENT' && (match.resultStatus === 'NONE' || isOpen(match.resultStatus));
        const state = scoreState(match.resultStatus);
        // Our own club is a given here: the row names the opponent, home or away and the time, and the score reads ours first.
        const home = match.homeClubId === data.clubId, away = !home && match.awayClubId === data.clubId;
        const opponent = home ? match.awayClubName : away ? match.homeClubName : null;
        const goals = away ? [match.awayScore, match.homeScore] : [match.homeScore, match.awayScore];
        const meta = [when, home ? copy('homeGame') : away ? copy('awayGame') : null, data.shown.length > 1 ? squadOf(match) : null,
            opponent && match.source === 'TOURNAMENT' ? match.tournamentName ?? match.title : null, match.locationName];
        return <ListRow key={match.id} to={page(match, needsResult ? '#result' : '')}
            lead={<ActivityBadge kind={friendly(match)} size={32} />} title={opponent ? copy('versus', { team: opponent }) : match.title} meta={meta.filter(Boolean).join(' · ')}
            trail={<>{scored ? <strong className="ch-result">{goals[0]}–{goals[1]}</strong>
                : needsResult ? <Status tone={state.tone}>{match.resultStatus === 'NONE' ? copy('addResult') : result(...state.words)}</Status>
                    : past ? <Status tone={isOfficial(match.resultStatus) ? 'accent' : 'neutral'}>{match.resultStatus === 'NONE' ? copy('noScore') : result(...state.words)}</Status> : null}<ChevronRight className="cw-chevron" aria-hidden="true" /></>} />;
    };
    const openRow = (m: Match) => {
        const slot = windowOf(m), mine = ours(m);
        const when = slot ? `${dayLabel(m.starts_at_iso, data.now)}${slot.days.length > 1 ? ` – ${dayLabel(m.ends_at_iso, data.now)}` : ''} · ${slot.from}–${slot.to}`
            : `${dayLabel(m.starts_at_iso, data.now)} ${timeLabel(m.starts_at_iso)}`;
        const state = asked(m) ? { word: say('Added against us · your answer', 'ჩვენთან დამატებულია · თქვენი პასუხი'), tone: 'warning' as const }
            : !mine ? { word: say('Your answer', 'თქვენი პასუხი'), tone: 'warning' as const }
            : m.requested_club_id ? { word: say('Waiting for their answer', 'მათ პასუხს ველოდებით'), tone: 'neutral' as const } : { word: say('Open challenge', 'ღია გამოწვევა'), tone: 'neutral' as const };
        const squad = mine ? m.squad_id : m.requested_squad_id ?? data.shown[0];
        return <ListRow key={m.event_id} to={matchPath(m.event_id, { kind: 'squad', id: squad })} lead={<ActivityBadge kind="FRIENDLY" size={32} />} title={m.title}
            meta={[when, mine && data.shown.length > 1 ? m.squad_name : null, mine ? null : m.club_name].filter(Boolean).join(' · ')}
            trail={<><Status tone={state.tone}>{state.word}</Status><ChevronRight className="cw-chevron" aria-hidden="true" /></>} />;
    };
    const loading = items === null;

    return <PageFrame className="cw-page ch-page">
        <PageHeader title={copy('matches')} actions={squadForMatch !== null ? <>
            <Button onClick={() => { setAdding(true); setNotice(''); }}><History aria-hidden="true" />{say('Add a past match', 'წარსული მატჩის დამატება')}</Button>
            {arrange()}
        </> : undefined} />
        <SquadSwitch data={data} />
        {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        {notice && <p className="gk-notice" role="status">{notice}</p>}
        {nextCards.map(card => <NextMatchCard key={card!.squadId} card={card!} data={data} onChanged={data.refresh} />)}
        {cardsFailed && <LoadFailed text={`${words('nextMatch')} · ${words('couldntLoad')}`} retry={words('tryAgain')} onRetry={data.retryCards} />}
        <div className="gk-stack">
            {scoresWaiting && <Section boxed icon={Trophy} title={say('Results waiting', 'შედეგები ელოდება')}>
                <ResultsWaitingList squadIds={data.shown} from={item => item.squadId ? { kind: 'squad', id: item.squadId } : null} />
            </Section>}
            <Section boxed title={copy('comingUp')} hint={upcoming.length ? `${upcoming.length}` : undefined}>
                <Panel flush>{loading ? <div className="cw-skeleton-rows" role="status" aria-label={copy('comingUp')}>{[0, 1].map(i => <Skeleton key={i} height={48} />)}</div>
                    : upcoming.length ? <List label={copy('comingUp')}>{upcoming.map(match => row(match, false))}</List>
                        : <EmptyNote title={copy('noMatchesSoon')} action={arrange('secondary')}>{copy('noMatchesSoonHint')}</EmptyNote>}</Panel>
            </Section>
            {open.length > 0 && <Section boxed title={say('Open challenges and invitations', 'ღია გამოწვევები და მოწვევები')} hint={`${open.length}`}>
                <Panel flush><List label={say('Open challenges and invitations', 'ღია გამოწვევები და მოწვევები')}>{open.map(openRow)}</List></Panel>
            </Section>}
            {loaded?.key === key && loaded.openFailed && <LoadFailed text={`${say('Open challenges and invitations', 'ღია გამოწვევები და მოწვევები')} · ${words('couldntLoad')}`}
                retry={words('tryAgain')} onRetry={() => setRevision(value => value + 1)} />}
            {/* One green-edged box between what is coming and what was played: the question, and the one button. */}
            {squadForMatch !== null && <div className="ch-arrange-box">
                <span className="ch-arrange-box__ask">{copy('arrangeAsk')}</span>
                {arrange()}
            </div>}
            <Section boxed title={copy('played')} hint={played.length ? `${played.length}` : undefined}>
                <Panel flush>{loading ? <div className="cw-skeleton-rows" role="status" aria-label={copy('played')}>{[0, 1, 2].map(i => <Skeleton key={i} height={48} />)}</div>
                    : played.length ? <List label={copy('played')}>{played.map(match => row(match, true))}</List>
                        : <EmptyNote title={copy('noMatchesPlayed')}>{copy('noMatchesPlayedHint')}</EmptyNote>}</Panel>
            </Section>
        </div>
        {adding && squadForMatch !== null && <PastMatchDialog clubId={data.clubId} squads={[{ id: squadForMatch, name: data.names.get(squadForMatch) ?? '' }]} onClose={() => setAdding(false)}
            onSaved={(_created, opponent, inApp) => {
                setAdding(false); setRevision(value => value + 1); data.refresh();
                setNotice(inApp ? say(`Added. ${opponent} can confirm or dispute the score for 48 hours.`, `დაემატა. ${opponent}-ს 48 საათის განმავლობაში შეუძლია ანგარიშის დადასტურება ან გასაჩივრება.`)
                    : say('Added to your results.', 'დაემატა თქვენს შედეგებს.'));
            }} />}
    </PageFrame>;
}
