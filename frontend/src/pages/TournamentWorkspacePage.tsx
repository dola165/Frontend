import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, Settings, Swords, Trash2, Trophy, Users } from 'lucide-react';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournament, removeEntry } from '../features/tournaments/api';
import { BracketEditor } from '../features/tournaments/components/BracketEditor';
import { EntryReviewPanel } from '../features/tournaments/components/EntryReviewPanel';
import { EventSettingsPanel } from '../features/tournaments/components/EventSettingsPanel';
import { QueueAndDraftBuilder } from '../features/tournaments/components/QueueAndDraftBuilder';
import { TournamentInvitationsPanel } from '../features/tournaments/components/TournamentInvitationsPanel';
import type { TournamentDetail, TournamentEntryDto } from '../features/tournaments/domain';
import { entryStatusTone, entryTypeLabel, tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';

type WorkspaceTab = 'participants' | 'bracketing' | 'invitations' | 'settings';

const tabs: { key: WorkspaceTab; label: string; icon: typeof Users }[] = [
 { key: 'participants', label: 'Participants', icon: Users },
 { key: 'bracketing', label: 'Bracketing', icon: Swords },
 { key: 'invitations', label: 'Invitations', icon: Mail },
 { key: 'settings', label: 'Settings', icon: Settings },
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

 const [tournament, setTournament] = useState<TournamentDetail | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState<WorkspaceTab>('participants');
 const [removingId, setRemovingId] = useState<number | null>(null);
 const [message, setMessage] = useState<string | null>(null);
 const [messageType, setMessageType] = useState<'success' | 'error'>('success');

 const showMessage = (text: string, type: 'success' | 'error') => {
  setMessage(text);
  setMessageType(type);
  setTimeout(() => setMessage(null), 4000);
 };

 const loadTournament = useCallback(async () => {
  if (tournamentId == null || Number.isNaN(tournamentId)) {
   setError('Invalid tournament ID.');
   setLoading(false);
   return;
  }
  setLoading(true);
  setError(null);
  try {
   setTournament(await fetchTournament(tournamentId));
  } catch (err) {
   setError(extractApiErrorMessage(err, 'Failed to load tournament.'));
  } finally {
   setLoading(false);
  }
 }, [tournamentId]);

 useEffect(() => { void loadTournament(); }, [loadTournament]);

 const confirmedEntries = useMemo(
  () => (tournament?.entries ?? []).filter((e) => e.status !== 'PENDING' && e.status !== 'REJECTED' && e.status !== 'WITHDRAWN'),
  [tournament?.entries],
 );

 const handleRemoveEntry = async (entryId: number) => {
  if (tournamentId == null) return;
  setRemovingId(entryId);
  try {
   await removeEntry(tournamentId, entryId);
   showMessage('Participant removed from event.', 'success');
   void loadTournament();
  } catch (err) {
   showMessage(extractApiErrorMessage(err, 'Failed to remove participant.'), 'error');
  } finally {
   setRemovingId(null);
  }
 };

 if (loading) {
  return (
   <div className="flex min-h-full items-center justify-center bg-[#0f1117]">
    <div className="flex flex-col items-center gap-4 text-center">
     <Loader2 className="h-10 w-10 animate-spin text-[#16a34a]" />
     <p className="text-sm text-[#a1a1aa]">Loading Tournament</p>
    </div>
   </div>
  );
 }

 if (error || !tournament) {
  return (
   <div className="flex min-h-full items-center justify-center bg-[#0f1117]">
    <div className="max-w-md text-center">
     <Trophy className="mx-auto mb-4 h-12 w-12 text-[#a1a1aa]" />
     <p className="text-lg font-semibold text-[#f4f4f5]">Tournament Not Found</p>
     <p className="mt-2 text-sm text-[#a1a1aa]">{error ?? 'The tournament could not be loaded.'}</p>
     <Link to="/tournaments/setup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
      <ArrowLeft className="h-4 w-4" />
      Back to Setup
     </Link>
    </div>
   </div>
  );
 }

 return (
  <div className="min-h-full bg-[#0f1117] text-[#f4f4f5] selection:bg-[#16a34a]/20">
   {/* Header */}
   <div className="border-b border-[#ffffff0d] bg-[#16181d]">
    <div className="px-6 py-5">
     <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
       <Link to="/tournaments/setup" className="inline-flex items-center gap-2 text-sm text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]">
        <ArrowLeft className="h-4 w-4" />
        Setup
       </Link>
       <h1 className="mt-1 text-xl font-semibold text-[#f4f4f5]">
        {tournament.name}
       </h1>
       <p className="mt-1 text-sm text-[#a1a1aa]">
        Event #{tournament.id} &middot; {tournament.status}
       </p>
      </div>
      <div className="flex flex-wrap gap-2">
       <span className="rounded-full bg-[var(--fc-surface-hover)] px-3 py-1.5 text-xs font-semibold text-[#f4f4f5]">
        {tournamentScopeLabel(tournament.participantScope)}
       </span>
       <span className="rounded-full bg-[var(--fc-surface-hover)] px-3 py-1.5 text-xs font-semibold text-[#f4f4f5]">
        {tournamentVisibilityLabel(tournament.visibility)}
       </span>
       <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        tournament.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' :
        tournament.status === 'COMPLETED' ? 'bg-slate-500/10 text-slate-400' :
        tournament.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400' :
        'bg-sky-500/10 text-sky-400'
       }`}>
        {tournament.status}
       </span>
      </div>
     </div>
    </div>
   </div>

   {/* Three-column workspace */}
   <div className="grid grid-cols-1 gap-0 px-6 pb-10 pt-4 xl:grid-cols-[280px_minmax(0,1fr)_280px] xl:gap-4">
    {/* Left Rail — Queue & Draft Builder */}
    <aside className="flex flex-col gap-3">
     <QueueAndDraftBuilder
      tournamentId={tournament.id}
      tournament={tournament}
      onRefresh={loadTournament}
     />
    </aside>

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
         {tab.label}
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

     {/* Tab content */}
     <div className="rounded-b-xl border border-t-0 border-[#ffffff0d] bg-[#16181d]">
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
           Confirmed Roster
           <span className="ml-2 text-[#a1a1aa]">{confirmedEntries.length}</span>
          </p>
         </div>
         {confirmedEntries.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[#a1a1aa]">
           No confirmed participants yet. Approve pending applications above.
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
                onClick={() => handleRemoveEntry(entry.id)}
                disabled={removingId === entry.id}
                className="inline-flex items-center justify-center rounded-xl border border-red-500/20 bg-transparent p-2 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                title="Remove from event"
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
        onRefresh={loadTournament}
       />
      )}

      {activeTab === 'invitations' && (
       <TournamentInvitationsPanel tournamentId={tournament.id} />
      )}

      {activeTab === 'settings' && (
       <EventSettingsPanel
        tournament={tournament}
        onRefresh={loadTournament}
       />
      )}
     </div>
    </section>

    {/* Right Rail — Info Panel */}
    <aside className="flex flex-col gap-3">
     <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
      <div className="border-b border-[#ffffff0d] px-5 py-4">
       <p className="text-sm font-semibold text-[#f4f4f5]">Tournament Info</p>
      </div>
      <div className="divide-y divide-[#ffffff0d] px-5 py-1 text-sm">
       <div className="flex justify-between gap-3 py-2.5">
        <span className="text-[#a1a1aa]">Host Club</span>
        <span className="font-semibold text-[#f4f4f5]">{tournament.hostClubId ?? 'None'}</span>
       </div>
       <div className="flex justify-between gap-3 py-2.5">
        <span className="text-[#a1a1aa]">Organizer</span>
        <span className="font-semibold text-[#f4f4f5]">#{tournament.organizerOrganizationId}</span>
       </div>
       <div className="flex justify-between gap-3 py-2.5">
        <span className="text-[#a1a1aa]">Registration</span>
        <span className="font-semibold text-[#f4f4f5]">{tournament.registrationPolicy === 'INVITE_ONLY' ? 'Invite-Only' : 'Open'}</span>
       </div>
       {tournament.startDate && (
        <div className="flex justify-between gap-3 py-2.5">
         <span className="text-[#a1a1aa]">Starts</span>
         <span className="font-semibold text-[#f4f4f5]">{new Date(tournament.startDate).toLocaleDateString()}</span>
        </div>
       )}
       {tournament.endDate && (
        <div className="flex justify-between gap-3 py-2.5">
         <span className="text-[#a1a1aa]">Ends</span>
         <span className="font-semibold text-[#f4f4f5]">{new Date(tournament.endDate).toLocaleDateString()}</span>
        </div>
       )}
       {tournament.registrationOpensAt && (
        <div className="flex justify-between gap-3 py-2.5">
         <span className="text-[#a1a1aa]">Reg Opens</span>
         <span className="font-semibold text-[#f4f4f5]">{new Date(tournament.registrationOpensAt).toLocaleString()}</span>
        </div>
       )}
       {tournament.registrationClosesAt && (
        <div className="flex justify-between gap-3 py-2.5">
         <span className="text-[#a1a1aa]">Reg Closes</span>
         <span className="font-semibold text-[#f4f4f5]">{new Date(tournament.registrationClosesAt).toLocaleString()}</span>
        </div>
       )}
      </div>
     </div>

     {tournament.description && (
      <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
       <div className="border-b border-[#ffffff0d] px-5 py-4">
        <p className="text-sm font-semibold text-slate-950">Description</p>
       </div>
       <p className="px-5 py-4 text-sm leading-6 text-slate-600">{tournament.description}</p>
      </div>
     )}

     {tournament.rules && (
      <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
       <div className="border-b border-[#ffffff0d] px-5 py-4">
        <p className="text-sm font-semibold text-slate-950">Rules</p>
       </div>
       <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-6 text-slate-600">{tournament.rules}</p>
      </div>
     )}

     {(tournament.staffAssignments?.length ?? 0) > 0 && (
      <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
       <div className="border-b border-[#ffffff0d] px-5 py-4">
        <p className="text-sm font-semibold text-[#f4f4f5]">Staff ({tournament.staffAssignments.length})</p>
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
   </div>
  </div>
 );
};
