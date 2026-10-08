import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { useClubEntryEligibility, useEntryCopy } from '../clubEntry';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ClipboardCheck, Loader2, Sparkles, UserPlus, X, XCircle } from 'lucide-react';
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
  onClose: () => void;
  onStateChange: (nextState: {
    relationshipState: ClubRelationshipState;
    playerAffiliationStatus?: PlayerAffiliationStatus | null;
    pendingApplicationId?: number | null;
    pendingApplicationRole?: ClubMembershipRole | null;
  }) => void;
}

export const ClubApplicationPanel = (props: ClubApplicationPanelProps) => {
  const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  return <ClubApplicationBody key={`${sessionId}:${props.clubId}`} {...props} />;
};

const ClubApplicationBody = ({
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
  onClose,
  onStateChange
}: ClubApplicationPanelProps) => {
  const { t } = useTranslation();
  const { copy, reason } = useEntryCopy();
  const eligibility = useClubEntryEligibility(clubId, 'PLAYER', playerJoinPolicy === 'OPEN_TRIAL' ? 'OPEN_TRIAL' : 'JOIN', isAuthenticated);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  const [playerMessage, setPlayerMessage] = useState('');
  const [playerPosition, setPlayerPosition] = useState('GOALKEEPER');
  const [playerAgeGroup, setPlayerAgeGroup] = useState('');
  const [pendingKey, setPendingKey] = useState<'player' | 'cancel' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePlayerAction = async () => {
    if (mutation.current || !eligibility.allowed) return;
    const request = new AbortController(); mutation.current = request;
    const config = { _authSessionId: eligibility.sessionId, signal: request.signal };
    setPendingKey('player');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (playerJoinPolicy === 'OPEN_TRIAL') {
        await selfRegisterClubPlayer(clubId, config);
        if (request.signal.aborted) return;
        onStateChange({ relationshipState: 'TRIALIST', playerAffiliationStatus: 'TRIALIST', pendingApplicationId: null, pendingApplicationRole: null });
        setSuccessMessage(t('apply.canTrain', { clubName }));
        return;
      }

      const response = await createClubApplication(clubId, 'PLAYER', playerMessage.trim() || null, {
        position: playerPosition || null,
        ageGroup: playerAgeGroup || null,
      }, config);
      if (request.signal.aborted) return;
      onStateChange({ relationshipState: 'APPLIED', playerAffiliationStatus: null, pendingApplicationId: response.applicationId, pendingApplicationRole: 'PLAYER' });
      setSuccessMessage(t('apply.requestSent', { clubName }));
      eligibility.reload();
    } catch (error) {
      if (!request.signal.aborted) { setErrorMessage(extractApiErrorMessage(error, t('apply.submitFailed'))); eligibility.reload(); }
    } finally {
      if (!request.signal.aborted) { mutation.current = null; setPendingKey(null); }
    }
  };

  const handleCancel = async () => {
    if (!pendingApplicationId || mutation.current) return;
    const request = new AbortController(); mutation.current = request;
    setPendingKey('cancel');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await cancelClubApplication(clubId, pendingApplicationId, { _authSessionId: eligibility.sessionId, signal: request.signal });
      if (request.signal.aborted) return;
      onStateChange({ relationshipState: 'NONE', playerAffiliationStatus: null, pendingApplicationId: null, pendingApplicationRole: null });
      setSuccessMessage(t('apply.cancelled'));
      eligibility.reload();
    } catch (error) {
      if (!request.signal.aborted) setErrorMessage(extractApiErrorMessage(error, t('apply.cancelFailed')));
    } finally {
      if (!request.signal.aborted) { mutation.current = null; setPendingKey(null); }
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
  const controlClass = 'w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-page)] px-3 py-2.5 text-sm font-medium text-[color:var(--text-primary)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15';

  return (
    <section role="dialog" aria-modal="true" aria-labelledby="club-entry-title" className="overflow-hidden rounded-2xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] text-[color:var(--text-primary)] shadow-[0_28px_90px_color-mix(in_srgb,_var(--color-shadow)_55%,_transparent)]">
      <header className="flex items-start justify-between gap-4 border-b border-[color:var(--theme-border)] px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">{t('apply.clubEntry')}</p>
            <h2 id="club-entry-title" className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl">{clubName}</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--theme-border)] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--theme-surface-inset)] hover:text-[color:var(--text-primary)]">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="p-5 sm:p-6">
        <p className="max-w-xl text-sm leading-6 text-[color:var(--text-secondary)]">{t('apply.policyNote')}</p>

        {errorMessage && <div className="mt-4 rounded-xl border border-[color:var(--color-danger)]/25 bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--color-danger)]">{errorMessage}</div>}
        {successMessage && <div className="mt-4 rounded-xl border border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--color-accent)]">{successMessage}</div>}

        {!isAuthenticated ? (
          <div className="mt-5 rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-inset)] p-4 sm:p-5">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t('apply.signInPrompt')}</p>
            <button type="button" onClick={onSignIn} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-bold text-[var(--color-on-accent)] transition hover:bg-[var(--color-accent)]">{t('apply.signInToContinue')}</button>
          </div>
        ) : eligibility.loading ? (
          <p role="status" className="mt-5">{copy('Checking current eligibility…', 'მიმდინარე უფლებების შემოწმება…')}</p>
        ) : eligibility.error ? (
          <div role="alert" className="mt-5"><p>{copy('Eligibility could not load. Try again before applying.', 'მოთხოვნის უფლება ვერ შემოწმდა. სცადეთ ხელახლა.')}</p><button type="button" className="mt-3 underline" onClick={eligibility.reload}>{copy('Retry eligibility', 'ხელახლა შემოწმება')}</button></div>
        ) : eligibility.data && !eligibility.allowed ? (
          <div className="mt-5 rounded-xl border border-[color:var(--theme-border)] p-4"><p role="status">{reason(eligibility.data)}</p>
            {eligibility.data.pendingInvitationId ? <button type="button" className="mt-3 underline" onClick={onOpenInvites}>{copy('Review invitation', 'მოწვევის ნახვა')}</button>
              : <Link className="mt-3 inline-block underline" to={eligibility.data.pendingApplicationId ? `/account?tab=profile&applicationId=${eligibility.data.pendingApplicationId}` : '/account?tab=profile'}>{copy('Review account and requests', 'ანგარიშისა და მოთხოვნების ნახვა')}</Link>}
          </div>
        ) : relationshipState === 'INVITED' ? (
          <div className="mt-5 rounded-xl border border-[color:var(--color-info)]/25 bg-[color:var(--color-info)]/10 p-4 sm:p-5">
            <StatusBadge tone="info">{t('apply.invited')}</StatusBadge>
            <p className="mt-3 text-sm leading-6 text-[color:var(--color-info)]">{t('apply.invitedNote')}</p>
            <button type="button" onClick={onOpenInvites} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[color:var(--color-info)] px-5 text-sm font-bold text-[color:var(--color-on-accent)] transition hover:bg-[color:var(--color-info)]">{t('apply.reviewInvite')}</button>
          </div>
        ) : relationshipState === 'APPLIED' && pendingApplicationId ? (
          <div className="mt-5 rounded-xl border border-[color:var(--color-warning)]/25 bg-[color:var(--color-warning)]/10 p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="info">{clubApplicationStatusLabel('PENDING')}</StatusBadge>
              {pendingApplicationRole && <StatusBadge tone="neutral">{clubRoleLabel(pendingApplicationRole)}</StatusBadge>}
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--color-warning)]">{t('apply.pendingNote')}</p>
            <button type="button" onClick={() => void handleCancel()} disabled={pendingKey === 'cancel'} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 px-5 text-sm font-bold text-[color:var(--color-danger)] transition hover:bg-[color:var(--color-danger)]/20 disabled:cursor-not-allowed disabled:opacity-60">
              {pendingKey === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} {t('apply.cancelRequest')}
            </button>
          </div>
        ) : playerAffiliationStatus === 'TRIALIST' || relationshipState === 'TRIALIST' ? (
          <div className="mt-5 flex gap-3 rounded-xl border border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/10 p-4 sm:p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-accent)]" />
            <div><p className="font-bold text-[color:var(--color-accent)]">{t('apply.trialist')}</p><p className="mt-1 text-sm leading-6 text-[color:var(--color-accent)]/80">{t('apply.trialistNote')}</p></div>
          </div>
        ) : playerAffiliationStatus === 'ACTIVE' || relationshipState === 'ACTIVE' ? (
          <div className="mt-5 flex gap-3 rounded-xl border border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/10 p-4 sm:p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-accent)]" />
            <div><p className="font-bold text-[color:var(--color-accent)]">{t('apply.activePlayer')}</p><p className="mt-1 text-sm leading-6 text-[color:var(--color-accent)]/80">{t('apply.activePlayerNote')}</p></div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-inset)] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[var(--color-accent)]"><Sparkles className="h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-[0.18em]">{t('apply.playerRoute')}</p></div>
            <h3 className="mt-3 text-xl font-bold tracking-tight">{playerHeadline}</h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{playerDescription}</p>

            {playerJoinPolicy === 'APPLICATION_REQUIRED' && (
              <div className="mt-5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5"><span className="text-xs font-bold text-[color:var(--text-secondary)]">{t('apply.preferredPosition')}</span><select value={playerPosition} onChange={(event) => setPlayerPosition(event.target.value)} className={controlClass}>{['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'].map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
                  <label className="space-y-1.5"><span className="text-xs font-bold text-[color:var(--text-secondary)]">{t('apply.ageGroup')}</span><select value={playerAgeGroup} onChange={(event) => setPlayerAgeGroup(event.target.value)} className={controlClass}><option value="">{t('apply.notSure')}</option>{['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'].map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
                </div>
                <textarea value={playerMessage} onChange={(event) => setPlayerMessage(event.target.value)} rows={4} maxLength={2000} placeholder={t('apply.aboutYou')} className={`${controlClass} resize-none placeholder:text-[color:var(--text-muted)]`} />
              </div>
            )}

            {playerJoinPolicy !== 'INVITE_ONLY' && (
              <button type="button" onClick={() => void handlePlayerAction()} disabled={pendingKey === 'player' || !eligibility.allowed} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-bold text-[var(--color-on-accent)] shadow-[0_10px_28px_color-mix(in_srgb,_var(--color-shadow)_22%,_transparent)] transition hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-70">
                {pendingKey === 'player' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} {playerJoinPolicy === 'OPEN_TRIAL' ? t('apply.joinTrainingCta') : t('apply.requestEntryCta')}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
