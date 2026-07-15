import { useState } from 'react';
import { ClipboardCheck, Loader2, Send, Sparkles, UserPlus, XCircle } from 'lucide-react';
import { cancelClubApplication, createClubApplication, selfRegisterClubPlayer } from '../../clubs/api';
import {
  clubApplicationStatusLabel,
  clubRoleLabel,
  type ClubMembershipRole,
  type ClubRelationshipState,
  type PlayerAffiliationStatus,
  type PlayerJoinPolicy
} from '../../clubs/domain';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { StatusBadge } from '../../../components/ui/StatusBadge';

interface ClubApplicationPanelProps {
  clubId: number;
  clubName: string;
  isAuthenticated: boolean;
  playerJoinPolicy: PlayerJoinPolicy;
  playerAffiliationStatus?: PlayerAffiliationStatus | null;
  relationshipState?: ClubRelationshipState | null;
  pendingApplicationId?: number | null;
  pendingApplicationRole?: ClubMembershipRole | null;
  onOpenInvites: () => void;
  onSignIn: () => void;
  onStateChange: (nextState: {
    relationshipState: ClubRelationshipState;
    playerAffiliationStatus?: PlayerAffiliationStatus | null;
    pendingApplicationId?: number | null;
    pendingApplicationRole?: ClubMembershipRole | null;
  }) => void;
}

export const ClubApplicationPanel = ({
  clubId,
  clubName,
  isAuthenticated,
  playerJoinPolicy,
  playerAffiliationStatus,
  relationshipState,
  pendingApplicationId,
  pendingApplicationRole,
  onOpenInvites,
  onSignIn,
  onStateChange
}: ClubApplicationPanelProps) => {
  const [playerMessage, setPlayerMessage] = useState('');
  const [coachMessage, setCoachMessage] = useState('');
  const [pendingKey, setPendingKey] = useState<'player' | 'coach' | 'cancel' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePlayerAction = async () => {
    setPendingKey('player');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (playerJoinPolicy === 'OPEN_TRIAL') {
        await selfRegisterClubPlayer(clubId);
        onStateChange({
          relationshipState: 'TRIALIST',
          playerAffiliationStatus: 'TRIALIST',
          pendingApplicationId: null,
          pendingApplicationRole: null
        });
        setSuccessMessage(`You can now train with ${clubName}.`);
        return;
      }

      const response = await createClubApplication(clubId, 'PLAYER', playerMessage.trim() || null);
      onStateChange({
        relationshipState: 'APPLIED',
        playerAffiliationStatus: null,
        pendingApplicationId: response.applicationId,
        pendingApplicationRole: 'PLAYER'
      });
      setSuccessMessage(`Player request sent to ${clubName}.`);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Failed to submit player request.'));
    } finally {
      setPendingKey(null);
    }
  };

  const handleCoachApply = async () => {
    setPendingKey('coach');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await createClubApplication(clubId, 'COACH', coachMessage.trim() || null);
      onStateChange({
        relationshipState: 'APPLIED',
        playerAffiliationStatus: null,
        pendingApplicationId: response.applicationId,
        pendingApplicationRole: 'COACH'
      });
      setSuccessMessage(`Coach application sent to ${clubName}.`);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Failed to submit coach application.'));
    } finally {
      setPendingKey(null);
    }
  };

  const handleCancel = async () => {
    if (!pendingApplicationId) {
      return;
    }

    setPendingKey('cancel');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await cancelClubApplication(clubId, pendingApplicationId);
      onStateChange({
        relationshipState: 'NONE',
        playerAffiliationStatus: null,
        pendingApplicationId: null,
        pendingApplicationRole: null
      });
      setSuccessMessage('Request cancelled.');
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Failed to cancel request.'));
    } finally {
      setPendingKey(null);
    }
  };

  const playerHeadline = playerJoinPolicy === 'OPEN_TRIAL'
    ? 'Join training'
    : playerJoinPolicy === 'APPLICATION_REQUIRED'
      ? 'Request to join'
      : 'Player entry is invite only';

  const playerDescription = playerJoinPolicy === 'OPEN_TRIAL'
    ? 'This club allows open training entry. You can join as a trialist first and decide later if the club is right for you.'
    : playerJoinPolicy === 'APPLICATION_REQUIRED'
      ? 'Send a lightweight player request and the club can decide when to bring you in.'
      : 'This club manages player entry directly. Wait for a club invitation or contact them through the public details on the page.';

  return (
    <section className="theme-surface theme-border rounded-xl border px-5 py-4 ">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Club Entry
          </div>
          <h3 className="mt-4 text-lg font-semibold uppercase tracking-tight text-slate-900">
            Connect with {clubName}
          </h3>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Player entry follows the club&apos;s policy, while coach applications stay as a separate review path.
          </p>
        </div>

        {(relationshipState === 'APPLIED' || relationshipState === 'TRIALIST' || relationshipState === 'ACTIVE') && (
          <StatusBadge tone="info">{relationshipState}</StatusBadge>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      )}

      {!isAuthenticated ? (
        <div className="mt-5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-4">
          <p className="text-sm font-medium text-slate-600">
            Sign in to join training, request player entry, or apply as a coach.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none"
          >
            Sign In To Continue
          </button>
        </div>
      ) : relationshipState === 'INVITED' ? (
        <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">Invited</StatusBadge>
            <p className="text-sm font-semibold text-sky-800">
              This club already invited you. Review that invite instead of starting another flow.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenInvites}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-900 shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-slate-300 active:translate-y-0.5 active:shadow-none"
          >
            Review Invite
          </button>
        </div>
      ) : relationshipState === 'APPLIED' && pendingApplicationId ? (
        <div className="mt-5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">{clubApplicationStatusLabel('PENDING')}</StatusBadge>
            {pendingApplicationRole && (
              <StatusBadge tone="neutral">{clubRoleLabel(pendingApplicationRole)}</StatusBadge>
            )}
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600">
            Your request is waiting for club review. You can cancel it while it remains pending.
          </p>
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={pendingKey === 'cancel'}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingKey === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Cancel Request
          </button>
        </div>
      ) : playerAffiliationStatus === 'TRIALIST' || relationshipState === 'TRIALIST' ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="success">Trialist</StatusBadge>
            <p className="text-sm font-semibold text-emerald-800">
              You are currently registered as a trialist with this club.
            </p>
          </div>
        </div>
      ) : playerAffiliationStatus === 'ACTIVE' || relationshipState === 'ACTIVE' ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="success">Active player</StatusBadge>
            <p className="text-sm font-semibold text-emerald-800">
              You already have an active player relationship with this club.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Player Route</p>
            </div>
            <h4 className="mt-4 text-base font-semibold uppercase tracking-tight text-slate-900">{playerHeadline}</h4>
            <p className="mt-2 text-sm font-medium text-slate-600">{playerDescription}</p>

            {playerJoinPolicy === 'APPLICATION_REQUIRED' && (
              <textarea
                value={playerMessage}
                onChange={(event) => setPlayerMessage(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Tell the club a little about yourself."
                className="theme-surface-muted theme-border mt-4 w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500"
              />
            )}

            {playerJoinPolicy === 'INVITE_ONLY' ? null : (
              <button
                type="button"
                onClick={() => void handlePlayerAction()}
                disabled={pendingKey === 'player'}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-emerald-600 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pendingKey === 'player' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {playerJoinPolicy === 'OPEN_TRIAL' ? 'Join Training' : 'Request Player Entry'}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-sky-500" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Coach Route</p>
            </div>
            <h4 className="mt-4 text-base font-semibold uppercase tracking-tight text-slate-900">Apply as coach</h4>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Coaching stays on a reviewed application path so the club can verify fit and access level before adding you to staff.
            </p>
            <textarea
              value={coachMessage}
              onChange={(event) => setCoachMessage(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Share your coaching background, age groups, or current availability."
              className="theme-surface-muted theme-border mt-4 w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => void handleCoachApply()}
              disabled={pendingKey === 'coach'}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-200 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-900 shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-slate-300 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pendingKey === 'coach' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Apply As Coach
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
