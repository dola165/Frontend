import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronRight, Clock3, MapPin, X } from 'lucide-react';
import type { ClubManagementOverview, ClubPlayerAffiliation, PageResult } from '../../features/clubs/domain';
import type { ScheduleEventOccurrence } from '../../features/schedule/api';
import type { WorkspaceTab, TryoutApplicantDto } from './types';
import { useDialogFocus } from './useDialogFocus';

interface ContextPanelProps {
 activeTab: WorkspaceTab;
 overview: ClubManagementOverview | null;
 playerDirectory: PageResult<ClubPlayerAffiliation> | null;
 tryoutApplicants: TryoutApplicantDto[];
 pendingTryoutCount: number;
 upcomingEvents: ScheduleEventOccurrence[];
 scheduleLoading: boolean;
 scheduleError: string | null;
 currentRole: string | null;
 onTabChange: (tab: WorkspaceTab) => void;
 onOpenSchedule: () => void;
 onRetrySchedule: () => void;
 mobileOpen: boolean;
 onClose: () => void;
}

export const ContextPanel = (props: ContextPanelProps) => {
 const {
 activeTab, overview, playerDirectory, tryoutApplicants, pendingTryoutCount, upcomingEvents, scheduleLoading, scheduleError,
 currentRole, onTabChange, onOpenSchedule, onRetrySchedule, mobileOpen, onClose,
 } = props;
 const { t } = useTranslation();
 const panelRef = useRef<HTMLElement>(null);
 const closeRef = useRef<HTMLButtonElement>(null);
 useDialogFocus(mobileOpen, panelRef, onClose, closeRef);

 return (
 <>
 {mobileOpen && <button type="button" aria-label={t('clubWorkspace.closeContext')} onClick={onClose} className="workspace-context-backdrop" />}
 <aside ref={panelRef} id="workspace-context" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined} aria-label="Club workspace context" className={`workspace-context-panel w-[280px] shrink-0 border-l border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] overflow-y-auto ${mobileOpen ? 'is-open' : ''}`}>
  <div className="p-4">
   <div className="flex items-center justify-between gap-2">
    <p className="text-xs font-semibold text-[var(--fc-text-muted)] uppercase tracking-wider">{t('clubWorkspace.context')}</p>
    <button ref={closeRef} type="button" onClick={onClose} aria-label={t('clubWorkspace.closeContext')} className="workspace-mobile-only rounded-lg p-1.5 text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]">
     <X className="h-4 w-4" />
    </button>
   </div>

   {/* ── overview ── */}
   {activeTab === 'overview' && (
    <div className="mt-3 space-y-3">
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
       <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Next 7 days</p>
       <CalendarDays className="h-4 w-4 text-[var(--fc-accent)]" />
      </div>
      {scheduleLoading ? (
       <p className="mt-2 text-xs text-[var(--fc-text-muted)]">Loading schedule…</p>
      ) : scheduleError ? (
       <>
        <p className="mt-2 text-xs text-[var(--fc-text-secondary)]">Schedule unavailable right now.</p>
        <button type="button" onClick={onRetrySchedule} className="mt-2 text-xs font-semibold app-text-action">Retry</button>
       </>
      ) : upcomingEvents.length === 0 ? (
       <p className="mt-2 text-xs text-[var(--fc-text-muted)]">No club events scheduled in the next 7 days.</p>
      ) : (
       <div className="mt-2 space-y-2">
        {upcomingEvents.slice(0, 3).map((event) => (
         <button key={`${event.eventId}-${event.occurrenceId}`} type="button" onClick={onOpenSchedule} className="block w-full rounded-lg border border-[var(--fc-border)] p-2 text-left hover:bg-[var(--fc-surface-hover)]">
          <p className="truncate text-xs font-semibold text-[var(--fc-text-primary)]">{event.title}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--fc-text-secondary)]"><Clock3 className="h-3 w-3" />{new Date(event.startsAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          {event.locationName && <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-[var(--fc-text-muted)]"><MapPin className="h-3 w-3 shrink-0" />{event.locationName}</p>}
         </button>
        ))}
       </div>
      )}
      <button type="button" onClick={onOpenSchedule} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold app-text-action">Open calendar <ChevronRight className="h-3.5 w-3.5" /></button>
     </div>
     {overview && (
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
       <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Quick Stats</p>
       <div className="mt-2 space-y-1.5 text-xs text-[var(--fc-text-secondary)]">
        <p>{overview.members.length} staff member{overview.members.length !== 1 ? 's' : ''}</p>
       <p>{overview.activePlayerCount} active player{overview.activePlayerCount !== 1 ? 's' : ''}</p>
       <p>{overview.trialistCount} trialist{overview.trialistCount !== 1 ? 's' : ''}</p>
       <p>{overview.pendingApplications.length + overview.pendingInvitations.length} pending application/invitation{overview.pendingApplications.length + overview.pendingInvitations.length !== 1 ? 's' : ''}</p>
       </div>
      </div>
     )}
    </div>
   )}

   {/* ── players ── */}
   {activeTab === 'players' && (
    <div className="mt-3 space-y-3">
     {/* Awaiting Decision */}
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Awaiting Decision <span className="font-normal text-[var(--fc-text-muted)]">(all)</span></p>
      <p className="mt-1 text-2xl font-semibold text-[color:var(--color-warning)]">
       {overview?.trialistCount ?? 0}
      </p>
      <p className="text-xs text-[var(--fc-text-secondary)]">players pending</p>
      {playerDirectory && playerDirectory.content.filter((p) => p.status === 'TRIALIST').slice(0, 5).map((p) => (
       <div key={p.userId} className="mt-2 flex items-center gap-2 rounded border border-[var(--fc-border)] p-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fc-surface-hover)] text-xs font-semibold text-[var(--fc-text-secondary)]">
         {(p.fullName || p.username || '?').charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 text-xs font-medium text-[var(--fc-text-primary)] truncate">{p.fullName || p.username}</span>
        <button
         type="button"
         onClick={() => { onTabChange('players'); onClose(); }}
         className="text-xs font-semibold shrink-0 app-text-action"
        >
         Review
        </button>
       </div>
      ))}
      {(!overview || overview.trialistCount === 0) && (
       <p className="mt-2 text-xs text-[var(--fc-text-muted)]">No players awaiting decision.</p>
      )}
     </div>

     {/* Active Squad */}
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Active Squad <span className="font-normal text-[var(--fc-text-muted)]">(current page)</span></p>
      {(() => {
       const activePlayers = playerDirectory?.content.filter((p) => p.status === 'ACTIVE') ?? [];
       const posCounts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
       const DEF_KEYS = ['DEF', 'DEFENDER', 'CB', 'LB', 'RB', 'SW', 'FB', 'WB'];
       const MID_KEYS = ['MID', 'MIDFIELDER', 'CM', 'CDM', 'CAM', 'LM', 'RM', 'DM', 'AM'];
       const FWD_KEYS = ['FWD', 'FORWARD', 'ST', 'CF', 'LW', 'RW', 'SS', 'WINGER'];
       activePlayers.forEach((p) => {
        const raw = p.position?.toUpperCase() || '';
        if (raw === 'GK' || raw === 'GOALKEEPER') posCounts.GK++;
        else if (DEF_KEYS.some((k) => raw === k || raw.startsWith(k))) posCounts.DEF++;
        else if (MID_KEYS.some((k) => raw === k || raw.startsWith(k))) posCounts.MID++;
        else if (FWD_KEYS.some((k) => raw === k || raw.startsWith(k))) posCounts.FWD++;
       });
       const maxCount = Math.max(...Object.values(posCounts), 1);
       const colors: Record<string, string> = {
        GK: 'var(--color-accent)', DEF: 'var(--color-info)', MID: 'var(--color-orange)', FWD: 'var(--color-danger)',
       };
       return (
        <>
         {activePlayers.length === 0 && (
          <p className="mt-1 text-xs text-[var(--fc-text-muted)]">No active players on this page.</p>
         )}
         {(Object.keys(posCounts) as (keyof typeof posCounts)[]).map((pos) => (
          <div key={pos} className="mt-2">
           <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--fc-text-secondary)]">{pos}</span>
            <span className="font-semibold text-[var(--fc-text-primary)]">{posCounts[pos]}</span>
           </div>
           <div className="mt-1 h-1.5 rounded-full bg-[var(--fc-surface-hover)]">
            <div
             className="h-full rounded-full transition-all"
             style={{ width: `${(posCounts[pos] / maxCount) * 100}%`, backgroundColor: colors[pos] }}
            />
           </div>
          </div>
         ))}
        </>
       );
      })()}
     </div>

     {/* Legend */}
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Legend</p>
      <div className="mt-2 space-y-1.5 text-xs text-[var(--fc-text-secondary)]">
       <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--fc-state-success)]" />
        Active — full member
       </div>
       <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--fc-state-warning)]" />
        Trialist — pending review
       </div>
       <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--fc-text-muted)]" />
        Past / Removed — inactive
       </div>
      </div>
     </div>
    </div>
   )}

   {/* ── personnel ── */}
   {activeTab === 'personnel' && (
    <div className="mt-3 space-y-3">
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Role Explanations</p>
      <div className="mt-2 space-y-2 text-xs">
       <div>
        <p className="font-semibold text-[var(--fc-text-primary)]">Owner</p>
        <p className="text-[var(--fc-text-secondary)]">Full control over the club. Can transfer ownership, manage all roles, and delete the club.</p>
       </div>
       <div>
        <p className="font-semibold text-[var(--fc-text-primary)]">Club Admin</p>
        <p className="text-[var(--fc-text-secondary)]">Day-to-day management. Can manage staff, players, squads, and review applications.</p>
       </div>
       <div>
        <p className="font-semibold text-[var(--fc-text-primary)]">Coach</p>
        <p className="text-[var(--fc-text-secondary)]">Manages squads and players. Can review tryouts but cannot change club settings.</p>
       </div>
      </div>
     </div>
     <button
      type="button"
      onClick={() => { onTabChange('invites'); onClose(); }}
      className="w-full rounded-xl border border-[var(--fc-accent-border)] bg-[var(--fc-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fc-accent)] hover:opacity-80 transition-opacity"
     >
      Invite Staff Members
     </button>
    </div>
   )}

   {/* ── invites ── */}
   {activeTab === 'invites' && (
    <div className="mt-3 space-y-3">
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Pending Invites</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--fc-accent)]">
       {overview?.pendingInvitations.length ?? 0}
      </p>
      <p className="text-xs text-[var(--fc-text-secondary)]">awaiting response</p>
     </div>
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Tips</p>
       <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
       {overview?.assignableInviteRoles.length
        ? 'Search for users by name or username, then select a role before sending an invitation.'
        : 'You can review and cancel pending invitations. New invitations are managed by club leadership.'}
      </p>
     </div>
    </div>
   )}

   {/* ── applications ── */}
   {activeTab === 'applications' && (
    <div className="mt-3 space-y-3">
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Pending Applications</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--fc-accent)]">
       {overview?.pendingApplications.length ?? 0}
      </p>
      <p className="text-xs text-[var(--fc-text-secondary)]">to review</p>
     </div>
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Review Tips</p>
      <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
       Accept to grant membership with the requested role. Decline to reject. Accepted members appear in the Personnel or Players tab.
      </p>
     </div>
    </div>
   )}

   {/* ── roles ── */}
   {activeTab === 'roles' && (
    <div className="mt-3 space-y-3">
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Role Hierarchy</p>
      <div className="mt-2 space-y-1.5 text-xs text-[var(--fc-text-secondary)]">
       <p><span className="font-semibold text-[var(--fc-text-primary)]">Owner</span> — Ultimate authority</p>
       <p className="ml-3"><span className="font-semibold text-[var(--fc-text-primary)]">Club Admin</span> — Appointed by Owner</p>
       <p className="ml-3"><span className="font-semibold text-[var(--fc-text-primary)]">Coach</span> — Manages players</p>
      </div>
     </div>
     {overview && currentRole === 'OWNER' && (
      <div className="rounded-xl border border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)] p-3">
       <p className="text-xs font-semibold text-[color:var(--color-warning)]">Transfer Ownership</p>
       <p className="mt-1 text-xs text-[color:var(--color-warning)]">
        Transferring ownership is permanent. You will become a Club Admin after the transfer.
       </p>
      </div>
     )}
    </div>
   )}

   {/* ── squads ── */}
   {activeTab === 'squads' && (
    <div className="mt-3 space-y-3">
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Squad Tips</p>
      <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
       Create squads to organize players into teams. Each squad can have its own roster with jersey numbers and positions.
      </p>
     </div>
    </div>
   )}

   {/* ── tryouts ── */}
   {activeTab === 'tryouts' && (
    <div className="mt-3 space-y-3">
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Applicant Stats</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--fc-accent)]">{pendingTryoutCount}</p>
      <p className="text-xs text-[var(--fc-text-secondary)]">awaiting decision</p>
     </div>
     {tryoutApplicants.length > 0 && (
      <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
       <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Position Breakdown</p>
       <div className="mt-2 space-y-1 text-xs text-[var(--fc-text-secondary)]">
        {Object.entries(
         tryoutApplicants.reduce<Record<string, number>>((acc, a) => {
          const pos = a.position || 'Unknown';
          acc[pos] = (acc[pos] || 0) + 1;
          return acc;
         }, {}),
        ).map(([pos, count]) => (
         <div key={pos} className="flex items-center justify-between">
          <span>{pos}</span>
          <span className="font-semibold">{count}</span>
         </div>
        ))}
       </div>
      </div>
     )}
    </div>
   )}

   {/* ── inbox ── */}
   {activeTab === 'inbox' && (
    <div className="mt-3 space-y-3">
     <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
      <p className="text-xs font-semibold text-[var(--fc-text-primary)]">Club Inbox</p>
      <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
       Notifications scoped to this club. Click a notification to navigate to the relevant page. Use "Mark All Read" to clear unread indicators.
      </p>
     </div>
    </div>
   )}
  </div>
 </aside>
 </>
 );
};
