import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Inbox, Loader2, XCircle } from 'lucide-react';
import { acceptClubInvitation, declineClubInvitation, fetchMyClubInvitations } from '../../clubs/api';
import {
    clubInviteStatusLabel,
    clubRoleLabel,
    type ClubInviteStatus,
    type MyClubInvitation
} from '../../clubs/domain';
import { EntitySection } from '../../../components/layout/EntityPageLayout';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useAuth } from '../../../context/AuthContext';
import { isCurrentAuthSession } from '../../../utils/authStorage';
import { emitNotificationsChanged } from '../../../utils/notifications';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useOtherClub } from '../../clubOperations/leaving/useOtherClub';

interface MyClubInvitationsPanelProps {
    onInvitationAccepted?: (invitation: MyClubInvitation) => void;
}

const formatDate = (value?: string | null) => {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getInviteTone = (status: ClubInviteStatus) => {
    switch (status) {
        case 'ACCEPTED':
            return 'success';
        case 'DECLINED':
            return 'danger';
        case 'CANCELLED':
        case 'EXPIRED':
        case 'UNAVAILABLE':
            return 'warning';
        case 'PENDING':
        default:
            return 'info';
    }
};

export const MyClubInvitationsPanel = ({ onInvitationAccepted }: MyClubInvitationsPanelProps) => {
    const { sessionId } = useAuth();
    return <ClubInvitations key={sessionId} onInvitationAccepted={onInvitationAccepted} />;
};

const ClubInvitations = ({ onInvitationAccepted }: MyClubInvitationsPanelProps) => {
    const { sessionId, refreshNavigationCapabilities } = useAuth();
    const copy = useJourneyCopy();
    const statusKa: Record<ClubInviteStatus, string> = { PENDING: 'მოლოდინში', ACCEPTED: 'მიღებულია', DECLINED: 'უარყოფილია', CANCELLED: 'გაუქმებულია', EXPIRED: 'ვადაგასულია', UNAVAILABLE: 'მიუწვდომელია' };
    const roleKa = { OWNER: 'მფლობელი', CLUB_ADMIN: 'კლუბის ადმინისტრატორი', COACH: 'მწვრთნელი', PLAYER: 'მოთამაშე' };
    const [invitations, setInvitations] = useState<MyClubInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const mounted = useRef(false);
    const submitting = useRef(false);
    const other = useOtherClub();

    useEffect(() => {
        mounted.current = true;
        const refresh = () => setAttempt(value => value + 1);
        const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
        window.addEventListener('focus', refresh);
        window.addEventListener('requests-updated', refresh);
        return () => { mounted.current = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('requests-updated', refresh); };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void fetchMyClubInvitations({ signal: controller.signal, _authSessionId: sessionId }).then(data => {
            if (controller.signal.aborted || !isCurrentAuthSession(sessionId)) return;
            setInvitations(data); setLoadError(null); setLoading(false);
        }).catch(error => {
            if (controller.signal.aborted || !isCurrentAuthSession(sessionId)) return;
            setLoadError(extractApiErrorMessage(error, '')); setLoading(false);
        });
        return () => controller.abort();
    }, [attempt, sessionId]);

    const orderedInvitations = useMemo(() => [...invitations].sort((left, right) => {
        if (left.status === right.status) {
            return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
        }
        if (left.status === 'PENDING') {
            return -1;
        }
        if (right.status === 'PENDING') {
            return 1;
        }
        return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    }), [invitations]);

    const runDecision = async (invitation: MyClubInvitation, decision: 'accept' | 'decline') => {
        if (submitting.current || !isCurrentAuthSession(sessionId)) return;
        submitting.current = true;
        const actionKey = `${decision}-${invitation.id}`;
        setPendingActionKey(actionKey);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const response = decision === 'accept'
                ? await acceptClubInvitation(invitation.id, { _authSessionId: sessionId })
                : await declineClubInvitation(invitation.id, { _authSessionId: sessionId });
            if (!mounted.current || !isCurrentAuthSession(sessionId)) return;

            const nextStatus = response.status as ClubInviteStatus;
            setInvitations((current) => current.map((item) => (
                item.id === invitation.id ? { ...item, status: nextStatus } : item
            )));

            window.dispatchEvent(new Event('requests-updated'));
            emitNotificationsChanged();
            if (decision === 'accept' && nextStatus === 'ACCEPTED') {
                setSuccessMessage(copy(`Joined ${invitation.clubName}.`, `${invitation.clubName}-ს შეუერთდით.`));
                await refreshNavigationCapabilities().catch(() => { if (mounted.current && isCurrentAuthSession(sessionId)) setErrorMessage(copy('Invitation accepted. Reload to refresh your navigation.', 'მოწვევა მიღებულია. ნავიგაციის გასაახლებლად ხელახლა ჩატვირთეთ გვერდი.')); });
                if (!mounted.current || !isCurrentAuthSession(sessionId)) return;
                onInvitationAccepted?.({ ...invitation, status: nextStatus });
                return;
            }

            if (nextStatus === 'DECLINED') setSuccessMessage(copy(`Invite to ${invitation.clubName} declined.`, `${invitation.clubName}-ის მოწვევა უარყოფილია.`));
        } catch (error) {
            // Staff means one club: "Leave {club} first", then accept again.
            if (mounted.current && isCurrentAuthSession(sessionId) && other.catchOther(error, () => void runDecision(invitation, decision))) return;
            if (mounted.current && isCurrentAuthSession(sessionId)) {
                setErrorMessage(extractApiErrorMessage(error, copy('Failed to update invitation.', 'მოწვევის განახლება ვერ მოხერხდა.')));
                window.dispatchEvent(new Event('requests-updated'));
                emitNotificationsChanged();
            }
        } finally {
            submitting.current = false;
            if (mounted.current && isCurrentAuthSession(sessionId)) setPendingActionKey(null);
        }
    };

    return (
        <EntitySection
            eyebrow={copy('Invitations', 'მოწვევები')}
            title={copy('Club invitations', 'კლუბის მოწვევები')}
            description={copy('When a club invites you, you can review and respond here.', 'კლუბის მოწვევა აქ შეგიძლიათ განიხილოთ და უპასუხოთ.')}
            actions={!loading && loadError === null ? (
                <StatusBadge tone={orderedInvitations.some((invite) => invite.status === 'PENDING') ? 'info' : 'neutral'}>
                    {copy(`${orderedInvitations.filter((invite) => invite.status === 'PENDING').length} pending`, `${orderedInvitations.filter((invite) => invite.status === 'PENDING').length} მოლოდინში`)}
                </StatusBadge>
            ) : undefined}
            bodyClassName="divide-y divide-[var(--color-border)]"
        >
            {other.notice}
            {errorMessage && (
                <div className="border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-4">
                    <div role="alert" className="border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                        {errorMessage}
                    </div>
                </div>
            )}

            {loadError !== null && <div role="alert" className="px-4 py-4">{loadError || copy('Failed to load club invitations.', 'კლუბის მოწვევები ვერ ჩაიტვირთა.')} <button type="button" className="min-h-11 px-3" onClick={() => setAttempt(value => value + 1)}>{copy('Try again', 'ხელახლა ცდა')}</button></div>}

            {successMessage && (
                <div className="border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-4">
                    <div role="status" className="border border-[color:var(--state-success)] bg-[color:var(--state-success-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-success)]">
                        {successMessage}
                    </div>
                </div>
            )}

            {loading ? (
                <div role="status" aria-label={copy('Loading invitations', 'მოწვევები იტვირთება')} className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
                </div>
            ) : orderedInvitations.length === 0 && loadError === null ? (
                <div className="px-4 py-10 text-center">
                    <Inbox className="mx-auto h-8 w-8 text-[var(--color-secondary)]" />
                    <p className="mt-4 text-sm leading-6 text-[var(--color-secondary)]">
                        {copy('You do not have any club invitations right now.', 'ამჟამად კლუბის მოწვევები არ გაქვთ.')}
                    </p>
                </div>
            ) : (
                orderedInvitations.map((invitation) => {
                    const createdAtLabel = formatDate(invitation.createdAt);
                    const expiresAtLabel = formatDate(invitation.expiresAt);
                    const isPending = invitation.status === 'PENDING';

                    return (
                        <article key={invitation.id} className="px-4 py-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-base font-semibold uppercase tracking-[0.12em] text-[var(--color-text)]">
                                            {invitation.clubName}
                                        </h4>
                                        <StatusBadge tone={getInviteTone(invitation.status)}>
                                            {copy(clubInviteStatusLabel(invitation.status), statusKa[invitation.status] ?? invitation.status)}
                                        </StatusBadge>
                                    </div>

                                    <p className="mt-2 text-[11px] font-semibold  text-[var(--color-secondary)]">
                                        {copy('Role offered:', 'შემოთავაზებული როლი:')} {copy(clubRoleLabel(invitation.role), roleKa[invitation.role] ?? invitation.role)}
                                    </p>

                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold  text-[var(--color-secondary)]">
                                        <span>{copy('Created:', 'შექმნილია:')} {createdAtLabel || copy('Recently', 'ახლახან')}</span>
                                        {expiresAtLabel && <span>{copy('Expires:', 'ვადა:')} {expiresAtLabel}</span>}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => void runDecision(invitation, 'decline')}
                                        disabled={!isPending || loadError !== null || pendingActionKey !== null}
                                        className="inline-flex items-center justify-center gap-2 border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-4 py-2.5 text-[11px] font-semibold  text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {pendingActionKey === `decline-${invitation.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                        {copy('Decline', 'უარყოფა')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void runDecision(invitation, 'accept')}
                                        disabled={!isPending || loadError !== null || pendingActionKey !== null}
                                        className="inline-flex items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)]-soft px-4 py-2.5 text-[11px] font-semibold  text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {pendingActionKey === `accept-${invitation.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        {copy('Accept', 'მიღება')}
                                    </button>
                                </div>
                            </div>
                        </article>
                    );
                })
            )}
        </EntitySection>
    );
};
