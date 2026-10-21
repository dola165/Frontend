import { ManagedTournamentMatchDialog } from '../features/tournaments/components/ManagedTournamentMatchDialog';
import { CompetitionOperationsPanel } from '../features/competitions/CompetitionOperationsPanel';
import { getCompetitionProfile, type Profile } from '../features/competitions/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Building2, CalendarDays, CheckCircle2, GitBranch, Trophy, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { ExtensionSurface } from '../features/capabilities/ExtensionBoundary';
import { isBracketParticipant } from '../features/tournaments/participantLabels';
import { getTournamentStartBlockers } from '../features/tournaments/startBlockers';
import { tournamentStatusLabel } from '../components/tournaments/tournamentFormatters';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useDialogFocus } from '../components/workspace/useDialogFocus';
import { TournamentTieBlockerBanner } from '../features/tournaments/components/TournamentTieResolution';
import { TournamentOverview, type TournamentWorkspaceSection } from '../features/tournaments/components/TournamentOverview';
import { TournamentPeople } from '../features/tournaments/components/TournamentPeople';
import { TournamentWorkspaceHeader } from '../features/tournaments/components/TournamentWorkspaceHeader';
import { WorkspaceShell } from '../design/workspace/WorkspaceShell';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import '../features/tournaments/components/tournament-hub.css';
import '../features/tournaments/components/tournament-workspace.css';
import '../features/tournaments/components/tournament-shell.css';

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
    const [profileError, setProfileError] = useState('');
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
        void getCompetitionProfile(id, controller.signal).then(value => { if (!controller.signal.aborted) { setProfile(value); setProfileError(''); } })
            .catch(cause => { if (!controller.signal.aborted) setProfileError(extractApiErrorMessage(cause, i18n.language.startsWith('ka') ? 'მატჩის მართვა ვერ ჩაიტვირთა. სცადეთ განახლება.' : 'Could not load match controls. Refresh to try again.')); });
        return () => controller.abort();
    }, [id, tournament?.fixtures, tournament?.status, i18n.language]);

    const refresh = useCallback(async () => {
        setRefreshing(true); setError('');
        try { setTournament(await fetchTournament(id)); }
        catch (err) { if (isAxiosError(err) && [401,403,404].includes(err.response?.status ?? 0)) setTournament(null); setError(extractApiErrorMessage(err, 'Could not refresh. Your current view is still here.')); throw err; }
        finally { setRefreshing(false); }
    }, [id]);
    const update = (value: TournamentDetail) => { setTournament(value); setError(''); };

    if (loading) return <GkRoot><PageFrame className="tws-state"><div role="status" aria-label={copy('Opening tournament workspace…', 'ტურნირის სივრცე იხსნება…')} className="tws-state__body"><Skeleton height={40} width="40%" /><Skeleton height={160} /></div></PageFrame></GkRoot>;
    if (!tournament) return <GkRoot><PageFrame className="tws-state"><div className="gk-panel tws-state__body">
        <EmptyNote title={copy('Tournament unavailable', 'ტურნირი მიუწვდომელია')} action={<span className="tws-state__actions"><Button onClick={() => void refresh().catch(() => {})}>{copy('Try again', 'ხელახლა ცდა')}</Button><ButtonLink variant="ghost" to="/tournaments">{copy('All tournaments', 'ყველა ტურნირი')}</ButtonLink></span>}><span role="alert">{error}</span></EmptyNote>
    </div></PageFrame></GkRoot>;

    const ready = tournament.entries.filter(isBracketParticipant);
    const waiting = tournament.entries.filter(e => ['PENDING', 'WAITLISTED'].includes(e.status)).length;
    const placed = new Set(tournament.fixtures.flatMap(f => [f.homeEntryId, f.awayEntryId]));
    const unplaced = ready.filter(e => !placed.has(e.id)).length;
    const emptyOpenings = tournament.fixtures.filter(f => f.status === 'SCHEDULED' && (f.roundNumber ?? 1) <= 1 && f.homeEntryId == null && f.awayEntryId == null).length;
    const unscheduled = tournament.fixtures.filter(f => f.status === 'SCHEDULED' && !f.scheduledAt).length;
    const match = tournament.fixtures.find(f => f.id === matchId);
    const startBlockers = getTournamentStartBlockers(tournament, new Date(), profile?.rules);
    const sections = [
        { id: 'overview', label: copy('Overview', 'მიმოხილვა'), icon: Trophy },
        { id: 'participants', label: copy('Participants', 'მონაწილეები'), icon: Users, count: permissions.canManage ? waiting : undefined },
        { id: 'bracket', label: copy('Competition', 'შეჯიბრება'), icon: GitBranch },
        { id: 'schedule', label: copy('Matchday', 'მატჩების დღე'), icon: CalendarDays },
        { id: 'people', label: copy('People', 'ადამიანები'), icon: Building2 },
    ];
    return <WorkspaceShell label={copy('Tournament workspace', 'ტურნირის სამუშაო სივრცე')} storageKey="tournament" sectionTitle={sections.find(item => item.id === tab)?.label ?? ''}
        context={{ name: tournament.name, role: tournamentStatusLabel(tournament.status, t), back: { label: copy('Tournament page', 'ტურნირის გვერდი'), to: `/tournaments/${id}` } }}
        primary={sections} groups={[]} active={tab} onSelect={next => setTab(next as Tab)}>
    <PageFrame className="tws-page">
        <TournamentWorkspaceHeader tournament={tournament} timezone={profile?.rules?.timezone} canEdit={permissions.canEditSettings} legacy={profile ? profile.legacy : null} busy={busy} refreshing={refreshing}
            finishBlocked={Boolean(tieState?.blocked)} startBlockers={startBlockers} onRefresh={() => void refresh().catch(() => {})} onEdit={() => setEditing(true)}
            onStart={() => setLifecycle('start')} onFinish={() => setLifecycle('finish')} onSection={setTab} />
    <div className="tw-workspace tc-workspace tws-body">
        {error && <p className="gk-notice gk-notice--danger tws-error" role="alert">{error}</p>}
        {profileError && <p role="alert">{profileError} <Button onClick={() => void refresh().catch(() => {})}>{copy('Retry match controls', 'მატჩის მართვის ხელახლა ჩატვირთვა')}</Button></p>}
        {matchId && !profile && !profileError && <p role="status">{copy('Loading match controls…', 'მატჩის მართვა იტვირთება…')}</p>}
        <div id="tournament-tie-blocker"><TournamentTieBlockerBanner state={tieState} tournament={tournament}/></div>
        {permissions.canManage && tournament.status === 'PLANNING' && tab === 'overview' && <div className="tw-progress">
            <button onClick={() => setTab('participants')}><CheckCircle2 size={20}/><span><strong>{ready.length} {copy(ready.length === 1 ? 'team confirmed' : 'teams confirmed', 'გუნდი დადასტურებულია')}</strong>{waiting ? `${waiting} ${copy('waiting for review', 'განხილვას ელოდება')}` : copy('Add clubs or guest teams', 'დაამატეთ კლუბები ან სტუმარი გუნდები')}</span></button>
            <button onClick={() => setTab('bracket')}><GitBranch size={20}/><span><strong>{tournament.stages.length ? copy('Competition created', 'შეჯიბრება შექმნილია') : copy('Create the competition', 'შექმენით შეჯიბრება')}</strong>{unplaced ? `${unplaced} ${copy(unplaced === 1 ? 'team to place' : 'teams to place', 'გუნდი გასანაწილებელია')}` : emptyOpenings ? `${emptyOpenings} ${copy('opening matches need teams', 'საწყის მატჩს გუნდი სჭირდება')}` : copy('Arrange the opening matches', 'განალაგეთ საწყისი მატჩები')}</span></button>
            <button onClick={() => setTab('schedule')}><CalendarDays size={20}/><span><strong>{unscheduled ? `${unscheduled} ${copy(unscheduled === 1 ? 'match needs a time' : 'matches need a time', 'მატჩის დრო დასანიშნია')}` : copy('Match schedule', 'მატჩების განრიგი')}</strong>{copy('Set times and review the matchday schedule', 'დანიშნეთ დრო და გადახედეთ მატჩების განრიგს')}</span></button>
        </div>}
        <div className="tws-sections">
        {tab === 'overview' && <TournamentOverview tournament={tournament} canManage={permissions.canManage} onSection={setTab} onMatch={fixture => setMatchId(fixture.id)}/>}
        <section hidden={tab !== 'people'}><TournamentPeople tournament={tournament} canEdit={permissions.canEditSettings} onUpdate={update}/></section>
        {/* Keep incomplete editors mounted during workspace tab navigation. */}
        <section hidden={tab !== 'participants'}><TournamentParticipants tournament={tournament} canManage={permissions.canManage} onUpdate={update} onRefresh={refresh} onBracket={() => setTab('bracket')}/><ExtensionSurface capability="tournamentSeries"><TournamentSeriesPanel tournamentId={id} tournamentName={tournament.name} canCreate={permissions.canEditSettings}/></ExtensionSurface></section>
        <section hidden={tab !== 'bracket'}>{tab === 'bracket' && <CompetitionOperationsPanel tournament={tournament} interactive changed={refresh} />}<TournamentCompetition tournament={tournament} timezone={profile?.rules?.timezone} matchesOnly={profile ? !profile.legacy : false} canManage={permissions.canManage && Boolean(profile?.legacy)} canScore={permissions.canScore} onUpdate={update} onMatch={f => setMatchId(f.id)} onTieStateChange={setTieState} onTieResolved={refresh}/></section>
        <section hidden={tab !== 'schedule'}><TournamentMatchday tournament={tournament} active={tab === 'schedule'} onMatch={f => setMatchId(f.id)} onBracket={() => setTab('bracket')}/></section>
        </div>
        {permissions.canEditSettings && <div hidden={!editing}>
            <div className="tw-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) closeEditor(); }}>
                <div className="tw-dialog tw-edit-dialog" ref={editDialog} role="dialog" aria-modal="true" aria-labelledby="tw-edit-tournament-title">
                    <header className="tw-edit-header"><div><h2 id="tw-edit-tournament-title">{tournament.status === 'PLANNING' ? copy('Edit tournament', 'ტურნირის რედაქტირება') : copy('Tournament details', 'ტურნირის დეტალები')}</h2><p>{copy('Name, visibility, dates, and other details.', 'სახელი, ხილვადობა, თარიღები და სხვა დეტალები.')}</p></div><button className="tw-icon" type="button" disabled={editSaving} aria-label={copy('Close tournament editor', 'ტურნირის რედაქტორის დახურვა')} onClick={closeEditor}><X size={18}/></button></header>
                    <TournamentSettings tournament={tournament} onUpdate={update} onSavingChange={setEditSaving} embedded />
                </div>
            </div>
        </div>}
        {match && profile?.legacy && <TournamentMatchDialog key={match.id} tournament={tournament} fixture={match} canManage={permissions.canManage} canScore={permissions.canScore} onUpdate={update} onClose={() => setMatchId(null)}/>}
        {match && profile?.rules && !profile.legacy && <ManagedTournamentMatchDialog key={match.id} tournament={tournament} fixture={match} profile={profile} canManage={permissions.canManage} canScore={permissions.canScore} onUpdate={update} onClose={() => setMatchId(null)}/>}
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
    </div>
    </PageFrame>
    </WorkspaceShell>;
}
