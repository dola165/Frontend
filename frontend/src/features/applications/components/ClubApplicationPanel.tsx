import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Loader2, Sparkles, UserPlus, XCircle } from 'lucide-react';
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
  const { t } = useTranslation();
  const [playerMessage, setPlayerMessage] = useState('');
  const [playerPosition, setPlayerPosition] = useState('GOALKEEPER');
  const [playerAgeGroup, setPlayerAgeGroup] = useState('');
  const [pendingKey, setPendingKey] = useState<'player' | 'cancel' | null>(null);
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
        setSuccessMessage(t('apply.canTrain', { clubName }));
        return;
      }

      const response = await createClubApplication(clubId, 'PLAYER', playerMessage.trim() || null, {
        position: playerPosition || null,
        ageGroup: playerAgeGroup || null,
      });
      onStateChange({
        relationshipState: 'APPLIED',
        playerAffiliationStatus: null,
        pendingApplicationId: response.applicationId,
        pendingApplicationRole: 'PLAYER'
      });
      setSuccessMessage(t('apply.requestSent', { clubName }));
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t('apply.submitFailed')));
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
      setSuccessMessage(t('apply.cancelled'));
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t('apply.cancelFailed')));
    } finally {
      setPendingKey(null);
    }
  };

  const playerHeadline = playerJoinPolicy === 'OPEN_TRIAL'
    ? t('apply.joinTraining')
    : playerJoinPolicy === 'APPLICATION_REQUIRED'
      ? t('apply.requestToJoin')
      : t('apply.inviteOnlyHeadline');

  const playerDescription = playerJoinPolicy === 'OPEN_TRIAL'
    ? t('apply.joinTrainingDescription')
    : playerJoinPolicy === 'APPLICATION_REQUIRED'
      ? t('apply.requestDescription')
      : t('apply.inviteOnlyDescription');

  return (
    <section className="theme-surface theme-border rounded-xl border px-5 py-4 ">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            <ClipboardCheck className="h-3.5 w-3.5" />
            {t('apply.clubEntry')}
          </div>
          <h3 className="mt-4 text-lg font-semibold uppercase tracking-tight text-slate-900">
            {t('apply.connectWith', { clubName })}
          </h3>
          <p className="mt-2 text-sm font-medium text-slate-600">
            {t('apply.policyNote')}
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
            {t('apply.signInPrompt')}
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none"
          >
            {t('apply.signInToContinue')}
          </button>
        </div>
      ) : relationshipState === 'INVITED' ? (
        <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">{t('apply.invited')}</StatusBadge>
            <p className="text-sm font-semibold text-sky-800">
              {t('apply.invitedNote')}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenInvites}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-900 shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-slate-300 active:translate-y-0.5 active:shadow-none"
          >
            {t('apply.reviewInvite')}
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
            {t('apply.pendingNote')}
          </p>
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={pendingKey === 'cancel'}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingKey === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            {t('apply.cancelRequest')}
          </button>
        </div>
      ) : playerAffiliationStatus === 'TRIALIST' || relationshipState === 'TRIALIST' ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="success">{t('apply.trialist')}</StatusBadge>
            <p className="text-sm font-semibold text-emerald-800">
              {t('apply.trialistNote')}
            </p>
          </div>
        </div>
      ) : playerAffiliationStatus === 'ACTIVE' || relationshipState === 'ACTIVE' ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="success">{t('apply.activePlayer')}</StatusBadge>
            <p className="text-sm font-semibold text-emerald-800">
              {t('apply.activePlayerNote')}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('apply.playerRoute')}</p>
            </div>
            <h4 className="mt-4 text-base font-semibold uppercase tracking-tight text-slate-900">{playerHeadline}</h4>
            <p className="mt-2 text-sm font-medium text-slate-600">{playerDescription}</p>

            {playerJoinPolicy === 'APPLICATION_REQUIRED' && (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t('apply.preferredPosition')}</label>
                    <select
                      value={playerPosition}
                      onChange={(event) => setPlayerPosition(event.target.value)}
                      className="theme-surface-muted theme-border w-full rounded-xl border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500"
                    >
                      {['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t('apply.ageGroup')}</label>
                    <select
                      value={playerAgeGroup}
                      onChange={(event) => setPlayerAgeGroup(event.target.value)}
                      className="theme-surface-muted theme-border w-full rounded-xl border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500"
                    >
                      <option value="">{t('apply.notSure')}</option>
                      {['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  value={playerMessage}
                  onChange={(event) => setPlayerMessage(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder={t('apply.aboutYou')}
                  className="theme-surface-muted theme-border w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {playerJoinPolicy === 'INVITE_ONLY' ? null : (
              <button
                type="button"
                onClick={() => void handlePlayerAction()}
                disabled={pendingKey === 'player'}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-emerald-600 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pendingKey === 'player' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {playerJoinPolicy === 'OPEN_TRIAL' ? t('apply.joinTrainingCta') : t('apply.requestEntryCta')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
