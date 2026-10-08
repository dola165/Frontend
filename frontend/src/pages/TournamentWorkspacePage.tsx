import { CompetitionOperationsPanel } from '../features/competitions/CompetitionOperationsPanel';
import { getCompetitionProfile, type Profile } from '../features/competitions/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, ExternalLink, GitBranch, Loader2, Pencil, Play, RefreshCw, Trophy, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MatchHistoryLink } from '../features/matchHistory/MatchHistoryLink';
import { useAuth } from '../context/AuthContext';
import { isAxiosError } from 'axios';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournament, finishTournament, startTournament } from '../features/tournaments/api';
import { useTournamentPermissions } from '../features/tournaments/useTournamentPermissions';
import type { TournamentDetail, TournamentTieState } from '../features/tournaments/domain';
import { TournamentParticipants } from '../features/tournaments/components/TournamentParticipants';
import { TournamentCompetition } from '../features/tournaments/components/TournamentCompetition';
import { TournamentMatchday } from '../features/tournaments/components/TournamentMatchday';
import { TournamentMatchDialog } from '../features/tournaments/components/TournamentMatchDialog';
import { TournamentSettings } from '../features/tournaments/components/TournamentSettings';
import { TournamentSeriesPanel } from '../features/tournamentSeries/TournamentSeriesPanel';
import { ExtensionDemoLabel, ExtensionSurface } from '../features/capabilities/ExtensionBoundary';
import { isExtensionCapabilityAvailable } from '../features/capabilities/extensions';
import { isBracketParticipant } from '../features/tournaments/participantLabels';
import { getTournamentStartBlockers } from '../features/tournaments/startBlockers';
import { formatTournamentDateRange, tournamentStatusLabel, tournamentVisibilityText } from '../components/tournaments/tournamentFormatters';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useDialogFocus } from '../components/workspace/useDialogFocus';
import { TournamentTieBlockerBanner } from '../features/tournaments/components/TournamentTieResolution';
import { TournamentOverview, type TournamentWorkspaceSection } from '../features/tournaments/components/TournamentOverview';
import { TournamentPeople } from '../features/tournaments/components/TournamentPeople';
import '../features/tournaments/components/tournament-hub.css';
import '../features/tournaments/components/tournament-workspace.css';

type Tab = TournamentWorkspaceSection;

export function TournamentWorkspacePage() {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const { user, sessionId } = useAuth();
    return <Workspace key={`${tournamentId}:${user?.id}:${sessionId}`} id={Number(tournamentId)} userId={user?.id}/>;
}

function Workspace({ id, userId }: { id: number; userId?: number }) {
    const { t, i18n } = useTranslation();
    const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
    const [tournament, setTournament] = useState<TournamentDetail | null>(null);
    const [profile, setProfile] = useState<Profile>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [searchParams, setSearchParams] = useSearchParams();
    const legacyTab=searchParams.get('tab');
    const requestedTab = searchParams.get('view') ?? (legacyTab==='matchday'?'bracket':legacyTab==='matches'?'schedule':legacyTab==='teams'?'participants':legacyTab);
    const tab: Tab = ['participants', 'bracket', 'schedule', 'people'].includes(requestedTab ?? '') ? requestedTab as Tab : 'overview';
    const setTab = (next: Tab) => setSearchParams(previous => {
        const params = new URLSearchParams(previous);
        if (next === 'overview') params.delete('view'); else params.set('view', next);
        params.delete('fixtureId');params.delete('tab');
        return params;
    }, { replace: true });
    const requestedMatch = Number(searchParams.get('fixtureId'));
    const matchId = Number.isSafeInteger(requestedMatch) && requestedMatch > 0 ? requestedMatch : null;
    const setMatchId = (fixtureId: number | null) => setSearchParams(previous => {
        const params = new URLSearchParams(previous);
        if (fixtureId == null) params.delete('fixtureId'); else params.set('fixtureId', String(fixtureId));
        return params;
    });
    const [lifecycle, setLifecycle] = useState<'start' | 'finish' | null>(null);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [tieState, setTieState] = useState<TournamentTieState | null>(null);
    const editDialog = useRef<HTMLDivElement>(null);
    const permissions = useTournamentPermissions(tournament, userId);
    const closeEditor = () => { if (!editSaving) setEditing(false); };
    useDialogFocus(editing && permissions.canEditSettings, editDialog, closeEditor);

    useEffect(() => {
        let active = true;
        if (!Number.isSafeInteger(id) || id < 1) {
            setError('Invalid tournament.'); setLoading(false); return;
        }
        fetchTournament(id).then(value => { if (active) setTournament(value); })
            .catch(err => { if (active) setError(extractApiErrorMessage(err, 'Could not load the tournament.')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);

    useEffect(() => {
        const controller = new AbortController();
        void getCompetitionProfile(id, controller.signal).then(value => { if (!controller.signal.aborted) setProfile(value); })
            .catch(() => { if (!controller.signal.aborted) setProfile(undefined); });
        return () => controller.abort();
    }, [id, tournament?.fixtures, tournament?.status]);

    const refresh = useCallback(async () => {
        setRefreshing(true); setError('');
        try { setTournament(await fetchTournament(id)); }
        catch (err) { if (isAxiosError(err) && [401,403,404].includes(err.response?.status ?? 0)) setTournament(null); setError(extractApiErrorMessage(err, 'Could not refresh. Your current view is still here.')); throw err; }
        finally { setRefreshing(false); }
    }, [id]);
    const update = (value: TournamentDetail) => { setTournament(value); setError(''); };

    if (loading) return <div className="tw-workspace tw-empty" role="status"><Loader2 className="animate-spin"/><p>{copy('Opening tournament workspace…', 'ტურნირის სივრცე იხსნება…')}</p></div>;
    if (!tournament) return <div className="tw-workspace tw-empty"><Trophy/><h1>{copy('Tournament unavailable', 'ტურნირი მიუწვდომელია')}</h1><p role="alert">{error}</p><button className="tw-button" onClick={() => void refresh().catch(() => {})}>{copy('Try again', 'ხელახლა ცდა')}</button><Link to="/tournaments" className="tw-button">{copy('All tournaments', 'ყველა ტურნირი')}</Link></div>;

    const ready = tournament.entries.filter(isBracketParticipant);
    const waiting = tournament.entries.filter(e => ['PENDING', 'WAITLISTED'].includes(e.status)).length;
    const placed = new Set(tournament.fixtures.flatMap(f => [f.homeEntryId, f.awayEntryId]));
    const unplaced = ready.filter(e => !placed.has(e.id)).length;
    const emptyOpenings = tournament.fixtures.filter(f => f.status === 'SCHEDULED' && (f.roundNumber ?? 1) <= 1 && f.homeEntryId == null && f.awayEntryId == null).length;
    const unscheduled = tournament.fixtures.filter(f => f.status === 'SCHEDULED' && !f.scheduledAt).length;
    const match = tournament.fixtures.find(f => f.id === matchId);
    const startBlockers = getTournamentStartBlockers(tournament, new Date(), profile?.rules);
    const tabs: { key: Tab; label: string; icon: typeof Users; count?: number }[] = [
        { key: 'overview', label: copy('Overview', 'მიმოხილვა'), icon: Trophy },
        { key: 'participants', label: copy('Participants', 'მონაწილეები'), icon: Users, count: tournament.entries.length },
        { key: 'bracket', label: copy('Competition', 'შეჯიბრება'), icon: GitBranch },
        { key: 'schedule', label: copy('Matchday', 'მატჩების დღე'), icon: CalendarDays },
        { key: 'people', label: copy('People', 'ადამიანები'), icon: Building2 },
    ];

    return <div className="tw-workspace tc-workspace">
        <Link className="tw-actions" style={{ color: 'var(--tw-muted)', fontSize: 12, marginBottom: 22 }} to={`/tournaments/${id}`}><ArrowLeft size={14}/>{copy('Tournament page', 'ტურნირის გვერდი')}</Link>
        <header className="tw-header">
            <div><p className="tw-eyebrow">{copy('Tournament workspace', 'ტურნირის სამუშაო სივრცე')}</p><h1>{tournament.name}</h1>
                <div className="tw-header-meta"><Link to={`/organizations/${tournament.organizerOrganizationId}`}><Building2 size={14}/>{tournament.organizerName || copy('Tournament organization', 'ტურნირის ორგანიზაცია')}</Link><span><CalendarDays size={14}/>{formatTournamentDateRange(tournament.startDate, tournament.endDate, i18n.language)}</span><span className="tw-badge is-ready">{tournamentStatusLabel(tournament.status, t)}</span><span className="tw-badge">{tournamentVisibilityText(tournament.visibility, t)}</span></div>
            </div>
            <div className="tw-actions"><button className="tw-icon" disabled={refreshing} aria-label={copy('Refresh tournament', 'ტურნირის განახლება')} onClick={() => void refresh().catch(() => {})}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/></button><Link className="tw-button" to={`/tournaments/${id}`}><ExternalLink size={14}/>{copy('View tournament', 'ტურნირის ნახვა')}</Link>
                <MatchHistoryLink tournamentId={id} className="tw-button" />
                {isExtensionCapabilityAvailable('volunteerShifts') && <Link className="tw-button" to={`/volunteering?tournamentId=${id}&view=manage`}>{copy('Volunteer shifts', 'მოხალისეთა ცვლები')}<ExtensionDemoLabel capability="volunteerShifts" /></Link>}
                {permissions.canEditSettings && <button className="tw-button" onClick={() => setEditing(true)}><Pencil size={14}/>{tournament.status === 'PLANNING' ? copy('Edit tournament', 'ტურნირის რედაქტირება') : copy('Tournament details', 'ტურნირის დეტალები')}</button>}
                {permissions.canEditSettings && tournament.status === 'PLANNING' && <div className="tw-start-control"><button className="tw-primary" aria-describedby={startBlockers.length ? 'tournament-start-blockers' : undefined} disabled={busy || startBlockers.length > 0} onClick={() => setLifecycle('start')}><Play size={14}/>{copy('Start tournament', 'ტურნირის დაწყება')}</button>{startBlockers.length > 0 && <details id="tournament-start-blockers" className="tw-start-blockers"><summary>{startBlockers.length} {copy(startBlockers.length === 1 ? 'check before starting' : 'checks before starting', 'შემოწმება დაწყებამდე')}</summary><ul>{startBlockers.map(blocker => <li key={blocker.key}>{blocker.message} <button type="button" onClick={() => blocker.target === 'settings' ? setEditing(true) : setTab(blocker.target)}>{blocker.target === 'settings' ? copy('Open settings', 'პარამეტრების გახსნა') : blocker.target === 'participants' ? copy('Open participants', 'მონაწილეების გახსნა') : blocker.target === 'schedule' ? copy('Open Matchday', 'მატჩების დღის გახსნა') : copy('Open Competition', 'შეჯიბრების გახსნა')}</button></li>)}</ul></details>}</div>}
                {permissions.canEditSettings && tournament.status === 'ACTIVE' && profile?.legacy && <button className="tw-primary" aria-describedby={tieState?.blocked ? 'tournament-tie-blocker' : undefined} disabled={busy || Boolean(tieState?.blocked)} onClick={() => setLifecycle('finish')}><Trophy size={14}/>{copy('Finish tournament', 'ტურნირის დასრულება')}</button>}
                {permissions.canEditSettings && tournament.status === 'ACTIVE' && profile && !profile.legacy && <button className="tw-primary" onClick={() => setTab('bracket')}>{copy('Review season outcome', 'სეზონის შედეგის განხილვა')}</button>}
            </div>
        </header>
        {error && <p className="tw-error" role="alert">{error}</p>}
        <div id="tournament-tie-blocker"><TournamentTieBlockerBanner state={tieState} tournament={tournament}/></div>
        {permissions.canManage && tournament.status === 'PLANNING' && tab === 'overview' && <div className="tw-progress">
            <button onClick={() => setTab('participants')}><CheckCircle2 size={20}/><span><strong>{ready.length} {copy(ready.length === 1 ? 'team confirmed' : 'teams confirmed', 'გუნდი დადასტურებულია')}</strong>{waiting ? `${waiting} ${copy('waiting for review', 'განხილვას ელოდება')}` : copy('Add clubs or guest teams', 'დაამატეთ კლუბები ან სტუმარი გუნდები')}</span></button>
            <button onClick={() => setTab('bracket')}><GitBranch size={20}/><span><strong>{tournament.stages.length ? copy('Competition created', 'შეჯიბრება შექმნილია') : copy('Create the competition', 'შექმენით შეჯიბრება')}</strong>{unplaced ? `${unplaced} ${copy(unplaced === 1 ? 'team to place' : 'teams to place', 'გუნდი გასანაწილებელია')}` : emptyOpenings ? `${emptyOpenings} ${copy('opening matches need teams', 'საწყის მატჩს გუნდი სჭირდება')}` : copy('Arrange the opening matches', 'განალაგეთ საწყისი მატჩები')}</span></button>
            <button onClick={() => setTab('schedule')}><CalendarDays size={20}/><span><strong>{unscheduled ? `${unscheduled} ${copy(unscheduled === 1 ? 'match needs a time' : 'matches need a time', 'მატჩის დრო დასანიშნია')}` : copy('Match schedule', 'მატჩების განრიგი')}</strong>{copy('Set times and review the matchday schedule', 'დანიშნეთ დრო და გადახედეთ მატჩების განრიგს')}</span></button>
        </div>}
        <div className="tc-workspace-frame"><nav className="tw-tabs tc-workspace-nav" aria-label={copy('Tournament workspace sections', 'ტურნირის სივრცის განყოფილებები')}>{tabs.map(item => <button key={item.key} aria-pressed={tab === item.key} onClick={() => setTab(item.key)}><item.icon size={16}/>{item.label}{item.count != null && <small>{item.count}</small>}</button>)}</nav><div className="tc-workspace-main">
        {tab === 'overview' && <TournamentOverview tournament={tournament} canManage={permissions.canManage} onSection={setTab} onMatch={fixture => setMatchId(fixture.id)}/>}
        <section hidden={tab !== 'people'}><TournamentPeople tournament={tournament} canEdit={permissions.canEditSettings} onUpdate={update}/></section>
        {/* Keep incomplete editors mounted during workspace tab navigation. */}
        <section hidden={tab !== 'participants'}><TournamentParticipants tournament={tournament} canManage={permissions.canManage} onUpdate={update} onRefresh={refresh} onBracket={() => setTab('bracket')}/><ExtensionSurface capability="tournamentSeries"><TournamentSeriesPanel tournamentId={id} tournamentName={tournament.name} canCreate={permissions.canEditSettings}/></ExtensionSurface></section>
        <section hidden={tab !== 'bracket'}>{tab === 'bracket' && <CompetitionOperationsPanel tournament={tournament} interactive changed={refresh} />}<TournamentCompetition tournament={tournament} matchesOnly={profile ? !profile.legacy : false} canManage={permissions.canManage && Boolean(profile?.legacy)} canScore={permissions.canScore} onUpdate={update} onMatch={f => setMatchId(f.id)} onTieStateChange={setTieState} onTieResolved={refresh}/></section>
        <section hidden={tab !== 'schedule'}><TournamentMatchday tournament={tournament} active={tab === 'schedule'} onMatch={f => setMatchId(f.id)} onBracket={() => setTab('bracket')}/></section>
        </div></div>
        {permissions.canEditSettings && <div hidden={!editing}>
            <div className="tw-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) closeEditor(); }}>
                <div className="tw-dialog tw-edit-dialog" ref={editDialog} role="dialog" aria-modal="true" aria-labelledby="tw-edit-tournament-title">
                    <header className="tw-edit-header"><div><h2 id="tw-edit-tournament-title">{tournament.status === 'PLANNING' ? copy('Edit tournament', 'ტურნირის რედაქტირება') : copy('Tournament details', 'ტურნირის დეტალები')}</h2><p>{copy('Name, visibility, dates, and other details.', 'სახელი, ხილვადობა, თარიღები და სხვა დეტალები.')}</p></div><button className="tw-icon" type="button" disabled={editSaving} aria-label={copy('Close tournament editor', 'ტურნირის რედაქტორის დახურვა')} onClick={closeEditor}><X size={18}/></button></header>
                    <TournamentSettings tournament={tournament} onUpdate={update} onSavingChange={setEditSaving} embedded />
                </div>
            </div>
        </div>}
        {match && <TournamentMatchDialog key={match.id} tournament={tournament} fixture={match} canManage={permissions.canManage} canScore={permissions.canScore} onUpdate={update} onClose={() => setMatchId(null)}/>}
        <ConfirmDialog open={lifecycle != null} title={lifecycle === 'start' ? copy('Start this tournament?', 'დაიწყოს ტურნირი?') : copy('Finish this tournament?', 'დასრულდეს ტურნირი?')}
            message={lifecycle === 'start' ? (tournament.visibility === 'PRIVATE' ? copy('This tournament is private. To let visitors see it, choose Edit tournament and change visibility before starting. Starting locks the competition and tournament details.', 'ეს ტურნირი პირადია. საჯაროდ საჩვენებლად დაწყებამდე აირჩიეთ ტურნირის რედაქტირება და შეცვალეთ ხილვადობა. დაწყება შეჯიბრებას და ტურნირის დეტალებს ჩაკეტავს.') : copy('Starting locks the competition and tournament details.', 'დაწყება შეჯიბრებას და ტურნირის დეტალებს ჩაკეტავს.')) : copy('All matches must have final results. The champion will appear on the tournament page.', 'ყველა მატჩის შედეგი საბოლოო უნდა იყოს. ჩემპიონი ტურნირის გვერდზე გამოჩნდება.')}
            confirmLabel={busy ? copy('Saving…', 'ინახება…') : copy('Confirm', 'დადასტურება')} cancelLabel={copy('Cancel', 'გაუქმება')}
            onCancel={() => { if (!busy) setLifecycle(null); }} onConfirm={async () => {
                if (busy) return;
                setBusy(true); setError('');
                try { update(await (lifecycle === 'start' ? startTournament(id) : finishTournament(id))); setLifecycle(null); }
                catch (err) { setLifecycle(null); setError(extractApiErrorMessage(err, copy('Could not change tournament status.', 'ტურნირის სტატუსი ვერ შეიცვალა.'))); }
                finally { setBusy(false); }
            }}/>
    </div>;
}
