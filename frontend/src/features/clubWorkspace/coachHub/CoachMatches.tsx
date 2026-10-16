import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { Button, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { useAuth } from '../../../context/AuthContext';
import { getMatchHistory, type HistoryMatch } from '../../matchHistory/api';
import { ArrangeMatchForm } from '../../matchExchange/arrange/ArrangeMatchForm';
import { arrangeDraftKey } from '../../world/compose/arrangeSeed';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { dayLabel, timeLabel } from '../fixtures';
import { ActivityBadge, SquadSwitch } from './CoachVisuals';
import { ResultDialog } from './ResultDialog';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

const friendly = (match: HistoryMatch) => /friendly/i.test(match.title) ? 'FRIENDLY' : 'MATCH';
const waitingWords: Record<string, string> = { PENDING: 'Waiting for the opponent', PROPOSED: 'Waiting for the opponent', INVITED: 'Waiting for the opponent', OPEN: 'Open to any club', CANCELLED: 'Cancelled' };

/**
 * My squads' matches, all on this page: arrange one in a dialog (the same form as World and the club page,
 * already on this squad), what is coming up, and what was played with the score, or "Add the result" where
 * it is missing. Nothing here leaves the page.
 */
export function CoachMatches({ data }: { data: CoachData }) {
    const copy = useCopy('coachHub', coachHubEn);
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
            .catch(cause => { if (!controller.signal.aborted) setPage({ key, items: [], error: extractApiErrorMessage(cause, 'Your matches could not be loaded.') }); });
        return () => controller.abort();
    }, [key, sessionId]);
    const error = page?.key === key ? page.error : '';

    const squadNames = data.shown.map(id => (data.names.get(id) ?? '').toLowerCase()).filter(Boolean);
    const mineMatch = (match: HistoryMatch) => data.shown.includes(match.homeSquadId ?? -1) || data.shown.includes(match.awaySquadId ?? -1)
        || squadNames.some(name => [match.homeSquadName, match.awaySquadName, match.title].some(text => text?.toLowerCase().includes(name)));
    const squadOf = (match: HistoryMatch) => data.names.get(match.homeSquadId ?? -1) ?? data.names.get(match.awaySquadId ?? -1) ?? match.homeSquadName ?? match.awaySquadName ?? '';
    const items = page?.key === key ? page.items.filter(mineMatch) : null;
    const time = (match: HistoryMatch) => match.startsAt ? new Date(match.startsAt).getTime() : 0;
    const upcoming = (items ?? []).filter(match => time(match) >= data.now && match.fixtureStatus !== 'CANCELLED').sort((a, b) => time(a) - time(b));
    const played = (items ?? []).filter(match => time(match) < data.now).sort((a, b) => time(b) - time(a));
    const squadForMatch = data.focus ?? data.mine[0]?.id ?? 0;
    // "+ Arrange a match" anywhere opens the form in a dialog here; `arrange=1` in the address does the same on arrival.
    const setArranging = (open: boolean) => { const next = new URLSearchParams(params); if (open) next.set('arrange', '1'); else next.delete('arrange'); setParams(next, { replace: !open }); };

    const row = (match: HistoryMatch, past: boolean) => {
        const when = match.startsAt ? `${dayLabel(match.startsAt, data.now)} ${timeLabel(match.startsAt)}` : 'Date to agree';
        const scored = match.homeScore != null && match.awayScore != null;
        const needsResult = past && !scored && match.resultStatus === 'NONE' && match.canRecordResult;
        const waiting = !past && waitingWords[match.fixtureStatus];
        // Our own club is a given here: the row names the opponent, home or away and the time, and the score reads ours first.
        const home = match.homeClubId === data.clubId, away = !home && match.awayClubId === data.clubId;
        const opponent = home ? match.awayClubName : away ? match.homeClubName : null;
        const ours = away ? [match.awayScore, match.homeScore] : [match.homeScore, match.awayScore];
        const meta = [when, home ? copy('homeGame') : away ? copy('awayGame') : null, data.shown.length > 1 ? squadOf(match) : null,
            opponent && match.source === 'TOURNAMENT' ? match.tournamentName ?? match.title : null, match.locationName];
        return <ListRow key={match.id} to={needsResult ? undefined : match.detailPath} onClick={needsResult ? () => setAdding(match) : undefined}
            lead={<ActivityBadge kind={friendly(match)} size={32} />} title={opponent ? `v ${opponent}` : match.title} meta={meta.filter(Boolean).join(' · ')}
            trail={<>{scored ? <strong className="ch-result">{ours[0]}–{ours[1]}</strong>
                : needsResult ? <span className="cw-status cw-status--warning">{copy('addResult')}</span>
                    : waiting ? <span className={`cw-status cw-status--${match.fixtureStatus === 'CANCELLED' ? 'danger' : 'warning'}`}>{waiting}</span>
                        : past ? <span className="cw-status">No score</span> : null}<ChevronRight className="cw-chevron" aria-hidden="true" /></>} />;
    };
    const loading = items === null;

    return <PageFrame className="cw-page ch-page">
        <PageHeader title={copy('matches')} actions={<Button variant="primary" onClick={() => setArranging(true)}><Plus aria-hidden="true" />{copy('arrangeMatch')}</Button>} />
        <SquadSwitch data={data} />
        {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        <div className="gk-stack">
            <Section boxed title={copy('comingUp')} hint={upcoming.length ? `${upcoming.length}` : undefined}>
                <Panel flush>{loading ? <div className="cw-skeleton-rows" role="status" aria-label={copy('comingUp')}>{[0, 1].map(i => <Skeleton key={i} height={48} />)}</div>
                    : upcoming.length ? <List label={copy('comingUp')}>{upcoming.map(match => row(match, false))}</List>
                        : <EmptyNote title={copy('noMatchesSoon')} action={<Button size="sm" onClick={() => setArranging(true)}>+ {copy('arrangeMatch')}</Button>}>{copy('noMatchesSoonHint')}</EmptyNote>}</Panel>
            </Section>
            {/* One green-edged box between what is coming and what was played: the question, and the one button. */}
            <div className="ch-arrange-box">
                <span className="ch-arrange-box__ask">{copy('arrangeAsk')}</span>
                <Button variant="primary" onClick={() => setArranging(true)}><Plus aria-hidden="true" />{copy('arrangeMatch')}</Button>
            </div>
            <Section boxed title={copy('played')} hint={played.length ? `${played.length}` : undefined}>
                <Panel flush>{loading ? <div className="cw-skeleton-rows" role="status" aria-label={copy('played')}>{[0, 1, 2].map(i => <Skeleton key={i} height={48} />)}</div>
                    : played.length ? <List label={copy('played')}>{played.map(match => row(match, true))}</List>
                        : <EmptyNote title={copy('noMatchesPlayed')}>{copy('noMatchesPlayedHint')}</EmptyNote>}</Panel>
            </Section>
        </div>
        {arranging && user && <Dialog open size="lg" title={copy('arrangeMatch')} description={data.names.get(squadForMatch)} onClose={() => setArranging(false)}>
            <div className="ch-arrange"><ArrangeMatchForm key={squadForMatch} mode="direct" squadId={squadForMatch} storageKey={arrangeDraftKey(user.id, sessionId, `coach-${squadForMatch}`)}
                onSent={() => { setArranging(false); setRevision(value => value + 1); data.refresh(); }} /></div>
        </Dialog>}
        {adding && <ResultDialog match={{ eventId: adding.sourceId, title: adding.title, startsAt: adding.startsAt ?? new Date(data.now).toISOString(), clubId: data.clubId,
            opponentClubId: adding.homeClubId === data.clubId ? adding.awayClubId : adding.homeClubId }} clubId={data.clubId} clubName={data.clubName} clubLogo={data.clubLogo} now={data.now}
            onClose={() => setAdding(null)} onDone={() => { setAdding(null); setRevision(value => value + 1); data.refresh(); }} />}
    </PageFrame>;
}
