import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, Settings, Swords, Trash2, Trophy, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournament, fetchMyOrganizations, removeEntry } from '../features/tournaments/api';
import { BracketEditor } from '../features/tournaments/components/BracketEditor';
import { EntryReviewPanel } from '../features/tournaments/components/EntryReviewPanel';
import { EventSettingsPanel } from '../features/tournaments/components/EventSettingsPanel';
import { TournamentInvitationsPanel } from '../features/tournaments/components/TournamentInvitationsPanel';
import { useTournamentPermissions } from '../features/tournaments/useTournamentPermissions';
import type { TournamentDetail, TournamentEntryDto } from '../features/tournaments/domain';
import { entryStatusTone, entryTypeLabel, tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

type WorkspaceTab = 'participants' | 'bracketing' | 'invitations';

const tabs: { key: WorkspaceTab; labelKey: string; icon: typeof Users }[] = [
 { key: 'participants', labelKey: 'tournaments.workspace.tabs.participants', icon: Users },
 { key: 'bracketing', labelKey: 'tournaments.workspace.tabs.bracketing', icon: Swords },
 { key: 'invitations', labelKey: 'tournaments.workspace.tabs.invitations', icon: Mail },
];

const statusToneBorder: Record<string, string> = {
 success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
 warning: 'bg-amber-50 text-amber-700 border-amber-200',
 info: 'bg-sky-50 text-sky-700 border-sky-200',
 danger: 'bg-rose-50 text-rose-700 border-rose-200',
 neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

const entryLabel = (entry: TournamentEntryDto): string =>
 entry.displayName ?? entry.clubName ?? entry.squadName ?? `Entry #${entry.id}`;

const entrySubLabel = (entry: TournamentEntryDto): string | null => {
 if (entry.clubName && entry.displayName && entry.displayName !== entry.clubName) return entry.clubName;
 if (entry.squadName && entry.clubName) return `${entry.clubName} / ${entry.squadName}`;
 return null;
};

export const TournamentWorkspacePage = () => {
 const { tournamentId: tournamentIdParam } = useParams<{ tournamentId: string }>();
 const tournamentId = tournamentIdParam ? Number(tournamentIdParam) : null;
 const { t } = useTranslation();
 const { user } = useAuth();

 const [tournament, setTournament] = useState<TournamentDetail | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState<WorkspaceTab>('participants');
 const [removingId, setRemovingId] = useState<number | null>(null);
 const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
 const [message, setMessage] = useState<string | null>(null);
 const [messageType, setMessageType] = useState<'success' | 'error'>('success');
 const [settingsOpen, setSettingsOpen] = useState(false);
 // W6.5 — resolve entity names instead of raw ids: the organizer's own orgs
 // (workspace implies organizer access) and the host club from its entries.
 const [organizations, setOrganizations] = useState<{ id: number; displayName: string }[]>([]);

 useEffect(() => {
  let active = true;
  fetchMyOrganizations()
   .then((data) => { if (active) setOrganizations(data); })
   .catch(() => {});
  return () => { active = false; };
 }, []);

 const permissions = useTournamentPermissions(tournament, user?.id);

 const hostClubName = useMemo(() => {
  if (!tournament?.hostClubId) return null;
  return tournament.entries.find((entry) => entry.clubId === tournament.hostClubId)?.clubName ?? null;
 }, [tournament]);

 const organizerName = useMemo(() => {
  if (!tournament) return null;
  return organizations.find((org) => org.id === tournament.organizerOrganizationId)?.displayName ?? null;
 }, [organizations, tournament]);

 const showMessage = (text: string, type: 'success' | 'error') => {
  setMessage(text);
  setMessageType(type);
  setTimeout(() => setMessage(null), 4000);
 };

 const loadTournament = useCallback(async () => {
  if (tournamentId == null || Number.isNaN(tournamentId)) {
   setError(t('tournaments.workspace.invalidId'));
   setLoading(false);
   return;
  }
  setLoading(true);
  setError(null);
  try {
   setTournament(await fetchTournament(tournamentId));
  } catch (err) {
   setError(extractApiErrorMessage(err, t('tournaments.workspace.loadFailed')));
  } finally {
   setLoading(false);
  }
 }, [tournamentId, t]);

 useEffect(() => { void loadTournament(); }, [loadTournament]);

 const confirmedEntries = useMemo(
  () => (tournament?.entries ?? []).filter((e) => e.status !== 'PENDING' && e.status !== 'REJECTED' && e.status !== 'WITHDRAWN'),
  [tournament?.entries],
 );

 const isBracketing = activeTab === 'bracketing';

 const handleRemoveEntry = async (entryId: number) => {
  if (tournamentId == null) return;
  setRemovingId(entryId);
  try {
   await removeEntry(tournamentId, entryId);
   showMessage(t('tournaments.workspace.participantRemoved'), 'success');
   void loadTournament();
  } catch (err) {
   showMessage(extractApiErrorMessage(err, t('tournaments.workspace.removeFailed')), 'error');
  } finally {
   setRemovingId(null);
  }
 };

 if (loading) {
  return (
   <div className="flex min-h-full items-center justify-center bg-[#0f1117]">
    <div className="flex flex-col items-center gap-4 text-center">
     <Loader2 className="h-10 w-10 animate-spin text-[#16a34a]" />
     <p className="text-sm text-[#a1a1aa]">{t('tournaments.workspace.loading')}</p>
    </div>
   </div>
  );
 }

 if (error || !tournament) {
  return (
   <div className="flex min-h-full items-center justify-center bg-[#0f1117]">
    <div className="max-w-md text-center">
     <Trophy className="mx-auto mb-4 h-12 w-12 text-[#a1a1aa]" />
     <p className="text-lg font-semibold text-[#f4f4f5]">{t('tournaments.workspace.notFound')}</p>
     <p className="mt-2 text-sm text-[#a1a1aa]">{error ?? t('tournaments.workspace.notFoundHint')}</p>
     <Link to="/tournaments/setup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
      <ArrowLeft className="h-4 w-4" />
      {t('tournaments.workspace.backToSetup')}
     </Link>
    </div>
   </div>
  );
 }

 return (
  <div className="min-h-full bg-[#0f1117] text-[#f4f4f5] selection:bg-[#16a34a]/20">
   {/* Banner header — ClubProfilePage-style cover, 3-4x taller, no Setup link */}
   <div className="relative h-72 border-b-2 border-white/10">
    {tournament.bannerImageUrl ? (
     <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${tournament.bannerImageUrl})` }}
     />
    ) : (
     <div className="absolute inset-0 bg-gradient-to-b from-[#0f1117] via-[#10131a] to-black" />
    )}
    <div className="absolute inset-0 bg-black/55" />
    <div className="relative flex h-full flex-col justify-end px-6 pb-6">
     <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
       <h1 className="text-3xl font-black tracking-tight text-white drop-shadow">
        {tournament.name}
       </h1>
       <p className="mt-2 text-sm font-semibold text-white/80">
        {t('tournaments.workspace.eventLabel', { id: tournament.id })} &middot; {tournament.status}
        {tournament.startDate && (
         <>
          &nbsp;&middot;&nbsp;
          {new Date(tournament.startDate).toLocaleDateString()}
          {tournament.endDate && <> &mdash; {new Date(tournament.endDate).toLocaleDateString()}</>}
         </>
        )}
       </p>
       <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
         {tournamentScopeLabel(tournament.participantScope)}
        </span>
        <span className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
         {tournamentVisibilityLabel(tournament.visibility)}
        </span>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
         tournament.status === 'ACTIVE' ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300' :
         tournament.status === 'COMPLETED' ? 'border-slate-500/40 bg-slate-500/20 text-slate-300' :
         tournament.status === 'CANCELLED' ? 'border-red-500/40 bg-red-500/20 text-red-300' :
         'border-sky-500/40 bg-sky-500/20 text-sky-300'
        }`}>
         {tournament.status}
        </span>
       </div>
      </div>
      {permissions.canEditSettings && (
       <button
        onClick={() => setSettingsOpen(true)}
        title={t('tournaments.workspace.settings')}
        className="inline-flex items-center justify-center rounded-lg border-2 border-white/20 bg-black/70 p-2.5 text-white transition-colors hover:border-[#16a34a] hover:text-[#16a34a]"
       >
        <Settings className="h-4 w-4" />
       </button>
      )}
     </div>
    </div>
   </div>

   {/* Workspace grid — full width on the Bracketing tab */}
   <div className={`grid grid-cols-1 gap-0 ${isBracketing ? 'pb-10' : 'px-6 pb-10 pt-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-4'}`}>

    {/* Center — Tabbed workspace */}
    <section className="min-w-0">
     {/* Tab bar */}
     <div className="flex rounded-t-xl border border-[#ffffff0d] bg-[#16181d]">
      {tabs.map((tab) => {
       const Icon = tab.icon;
       return (
        <button
         key={tab.key}
         onClick={() => setActiveTab(tab.key)}
         className={`flex flex-1 items-center justify-center gap-2 border-r border-[#ffffff0d] px-4 py-3.5 text-sm font-semibold transition-colors last:border-r-0 ${
          activeTab === tab.key
           ? 'bg-[#0f1117] text-[#16a34a]'
           : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[var(--fc-surface-hover)]'
         }`}
        >
         <Icon className="h-4 w-4" />
         {t(tab.labelKey)}
        </button>
       );
      })}
     </div>

     {/* Message toast */}
     {message && (
      <div className={`border border-t-0 border-[#ffffff0d] px-4 py-3 text-sm font-semibold ${
       messageType === 'success'
        ? 'bg-emerald-500/10 text-emerald-400'
        : 'bg-red-500/10 text-red-400'
      }`}>
       {message}
      </div>
     )}

     {/* Tab content — full-bleed on the Bracketing tab so the tree extends the page */}
     <div className={isBracketing ? 'border-y border-[#ffffff0d]' : 'rounded-b-xl border border-t-0 border-[#ffffff0d] bg-[#16181d]'}>
      {activeTab === 'participants' && (
       <div className="flex flex-col">
        {/* Pending Applications */}
        <EntryReviewPanel
         tournamentId={tournament.id}
         tournament={tournament}
         onRefresh={loadTournament}
        />

        {/* Confirmed Roster */}
        <div>
         <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
          <p className="text-sm font-semibold text-[#f4f4f5]">
           {t('tournaments.workspace.confirmedRoster')}
           <span className="ml-2 text-[#a1a1aa]">{confirmedEntries.length}</span>
          </p>
         </div>
         {confirmedEntries.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[#a1a1aa]">
           {t('tournaments.workspace.noConfirmed')}
          </div>
         ) : (
          <div className="max-h-[500px] overflow-y-auto">
           {confirmedEntries.map((entry) => {
            const tone = entryStatusTone(entry.status);
            const type = entryTypeLabel(entry);
            return (
             <div
              key={entry.id}
              className="flex items-center justify-between gap-3 border-b border-[#ffffff0d] px-5 py-3.5 transition-colors hover:bg-[var(--fc-surface-hover)]"
             >
              <div className="min-w-0 flex-1">
               <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-[#f4f4f5]">
                 {entryLabel(entry)}
                </p>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                 type === 'Club' ? 'border-sky-500/20 bg-sky-500/10 text-sky-400' :
                 type === 'Squad' ? 'border-violet-500/20 bg-violet-500/10 text-violet-400' :
                 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                }`}>
                 {type}
                </span>
               </div>
               {entrySubLabel(entry) && (
                <p className="mt-0.5 truncate text-xs text-[#a1a1aa]">{entrySubLabel(entry)}</p>
               )}
              </div>
              <div className="flex items-center gap-2">
               <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                {entry.status}
               </span>
               <button
                onClick={() => setConfirmRemoveId(entry.id)}
                disabled={removingId === entry.id}
                className="inline-flex items-center justify-center rounded-xl border border-red-500/20 bg-transparent p-2 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                title={t('tournaments.workspace.removeFromEvent')}
               >
                {removingId === entry.id ? (
                 <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                 <Trash2 className="h-3.5 w-3.5" />
                )}
               </button>
              </div>
             </div>
            );
           })}
          </div>
         )}
        </div>
       </div>
      )}

      {activeTab === 'bracketing' && (
       <BracketEditor
        tournamentId={tournament.id}
        tournament={tournament}
        canManage={permissions.canManage}
        onRefresh={loadTournament}
       />
      )}

      {activeTab === 'invitations' && (
       <TournamentInvitationsPanel tournamentId={tournament.id} />
      )}
     </div>
    </section>

    {/* Right Rail — Info Panel */}
    {!isBracketing && (
     <aside className="flex flex-col gap-3">
     <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
      <div className="border-b border-[#ffffff0d] px-5 py-4">
       <p className="text-sm font-semibold text-[#f4f4f5]">{t('tournaments.workspace.tournamentInfo')}</p>
      </div>
      <div className="divide-y divide-[#ffffff0d] px-5 py-1 text-sm">
       <div className="flex justify-between gap-3 py-2.5">
        <span className="text-[#a1a1aa]">{t('tournaments.workspace.hostClub')}</span>
        <span className="font-semibold text-[#f4f4f5]">
         {tournament.hostClubId
          ? (hostClubName ?? t('tournaments.workspace.clubFallback', { id: tournament.hostClubId }))
          : t('tournaments.workspace.noHostClub')}
        </span>
       </div>
       <div className="flex justify-between gap-3 py-2.5">
        <span className="text-[#a1a1aa]">{t('tournaments.workspace.organizer')}</span>
        <span className="font-semibold text-[#f4f4f5]">
         {organizerName ?? t('tournaments.workspace.orgFallback', { id: tournament.organizerOrganizationId })}
        </span>
       </div>
       <div className="flex justify-between gap-3 py-2.5">
        <span className="text-[#a1a1aa]">{t('tournaments.workspace.registration')}</span>
        <span className="font-semibold text-[#f4f4f5]">{tournament.registrationPolicy === 'INVITE_ONLY' ? t('tournaments.workspace.inviteOnly') : t('tournaments.workspace.open')}</span>
       </div>
       {tournament.startDate && (
        <div className="flex justify-between gap-3 py-2.5">
         <span className="text-[#a1a1aa]">{t('tournaments.workspace.starts')}</span>
         <span className="font-semibold text-[#f4f4f5]">{new Date(tournament.startDate).toLocaleDateString()}</span>
        </div>
       )}
       {tournament.endDate && (
        <div className="flex justify-between gap-3 py-2.5">
         <span className="text-[#a1a1aa]">{t('tournaments.workspace.ends')}</span>
         <span className="font-semibold text-[#f4f4f5]">{new Date(tournament.endDate).toLocaleDateString()}</span>
        </div>
       )}
       {tournament.registrationOpensAt && (
        <div className="flex justify-between gap-3 py-2.5">
         <span className="text-[#a1a1aa]">{t('tournaments.workspace.regOpens')}</span>
         <span className="font-semibold text-[#f4f4f5]">{new Date(tournament.registrationOpensAt).toLocaleString()}</span>
        </div>
       )}
       {tournament.registrationClosesAt && (
        <div className="flex justify-between gap-3 py-2.5">
         <span className="text-[#a1a1aa]">{t('tournaments.workspace.regCloses')}</span>
         <span className="font-semibold text-[#f4f4f5]">{new Date(tournament.registrationClosesAt).toLocaleString()}</span>
        </div>
       )}
      </div>
     </div>

     {tournament.description && (
      <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
       <div className="border-b border-[#ffffff0d] px-5 py-4">
        <p className="text-sm font-semibold text-[#f4f4f5]">{t('tournaments.workspace.description')}</p>
       </div>
       <p className="px-5 py-4 text-sm leading-6 text-[#a1a1aa]">{tournament.description}</p>
      </div>
     )}

     {tournament.rules && (
      <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
       <div className="border-b border-[#ffffff0d] px-5 py-4">
        <p className="text-sm font-semibold text-[#f4f4f5]">{t('tournaments.workspace.rules')}</p>
       </div>
       <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-6 text-[#a1a1aa]">{tournament.rules}</p>
      </div>
     )}

     {(tournament.staffAssignments?.length ?? 0) > 0 && (
      <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
       <div className="border-b border-[#ffffff0d] px-5 py-4">
        <p className="text-sm font-semibold text-[#f4f4f5]">{t('tournaments.workspace.staff', { count: tournament.staffAssignments.length })}</p>
       </div>
       <div className="max-h-[200px] overflow-y-auto">
        {tournament.staffAssignments.map((s) => (
         <div key={s.id} className="flex items-center justify-between gap-2 border-b border-[#ffffff0d] px-5 py-3 text-sm">
          <span className="truncate font-semibold text-[#f4f4f5]">{s.fullName}</span>
          <span className="rounded-full bg-[var(--fc-surface-hover)] px-2.5 py-0.5 text-xs font-medium text-[#a1a1aa]">{s.role}</span>
         </div>
        ))}
       </div>
      </div>
     )}
    </aside>
    )}
   </div>

   {/* Entry removal confirmation */}
   <ConfirmDialog
    open={confirmRemoveId != null}
    title={t('tournaments.workspace.removeParticipant')}
    message={t('tournaments.diagram.confirmUndone')}
    variant="danger"
    confirmLabel={t('tournaments.workspace.remove')}
    onCancel={() => setConfirmRemoveId(null)}
    onConfirm={() => {
     const entryId = confirmRemoveId;
     setConfirmRemoveId(null);
     if (entryId != null) void handleRemoveEntry(entryId);
    }}
   />

   {/* Settings modal (gear, top-right) */}
   {settingsOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSettingsOpen(false)}>
     <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#ffffff0d] bg-[#16181d]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3 border-b border-[#ffffff0d] px-5 py-3">
       <p className="text-sm font-semibold text-[#f4f4f5]">{t('tournaments.workspace.settings')}</p>
       <button onClick={() => setSettingsOpen(false)} className="text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]" title={t('tournaments.workspace.close')}>
        <X className="h-4 w-4" />
       </button>
      </div>
      <EventSettingsPanel tournament={tournament} onRefresh={loadTournament} />
     </div>
    </div>
   )}
  </div>
 );
};
