import { useEffect, useMemo, useState } from 'react';
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
            return 'warning';
        case 'PENDING':
        default:
            return 'info';
    }
};

export const MyClubInvitationsPanel = ({ onInvitationAccepted }: MyClubInvitationsPanelProps) => {
    const [invitations, setInvitations] = useState<MyClubInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadInvitations = async () => {
        setLoading(true);
        try {
            const data = await fetchMyClubInvitations();
            setInvitations(data || []);
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Failed to load club invitations.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadInvitations();
    }, []);

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
        const actionKey = `${decision}-${invitation.id}`;
        setPendingActionKey(actionKey);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const response = decision === 'accept'
                ? await acceptClubInvitation(invitation.id)
                : await declineClubInvitation(invitation.id);

            const nextStatus = response.status as ClubInviteStatus;
            setInvitations((current) => current.map((item) => (
                item.id === invitation.id ? { ...item, status: nextStatus } : item
            )));

            if (decision === 'accept') {
                setSuccessMessage(`Joined ${invitation.clubName}. Redirecting to the club workspace...`);
                onInvitationAccepted?.({ ...invitation, status: nextStatus });
                return;
            }

            setSuccessMessage(`Invite to ${invitation.clubName} declined.`);
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Failed to update invitation.'));
        } finally {
            setPendingActionKey(null);
        }
    };

    return (
        <EntitySection
            eyebrow="Invitations"
            title="Club Invites"
            description="Review incoming club invites here before you create a club or join one."
            actions={(
                <StatusBadge tone={orderedInvitations.some((invite) => invite.status === 'PENDING') ? 'info' : 'neutral'}>
                    {orderedInvitations.filter((invite) => invite.status === 'PENDING').length} pending
                </StatusBadge>
            )}
            bodyClassName="divide-y divide-[color:#ffffff0d]"
        >
            {errorMessage && (
                <div className="border-b border-[#ffffff0d] px-4 py-4">
                    <div className="border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                        {errorMessage}
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="border-b border-[#ffffff0d] px-4 py-4">
                    <div className="border border-[color:var(--state-success)] bg-[color:var(--state-success-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-success)]">
                        {successMessage}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#16a34a]" />
                </div>
            ) : orderedInvitations.length === 0 ? (
                <div className="px-4 py-10 text-center">
                    <Inbox className="mx-auto h-8 w-8 text-[#a1a1aa]" />
                    <p className="mt-4 text-sm leading-6 text-[#a1a1aa]">
                        No club invitations are waiting for this account right now.
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
                                        <h4 className="text-base font-semibold uppercase tracking-[0.12em] text-[#f4f4f5]">
                                            {invitation.clubName}
                                        </h4>
                                        <StatusBadge tone={getInviteTone(invitation.status)}>
                                            {clubInviteStatusLabel(invitation.status)}
                                        </StatusBadge>
                                    </div>

                                    <p className="mt-2 text-[11px] font-semibold  text-[#a1a1aa]">
                                        Role offered: {clubRoleLabel(invitation.role)}
                                    </p>

                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold  text-[#a1a1aa]">
                                        <span>Created: {createdAtLabel || 'Recently'}</span>
                                        {expiresAtLabel && <span>Expires: {expiresAtLabel}</span>}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => void runDecision(invitation, 'decline')}
                                        disabled={!isPending || pendingActionKey === `accept-${invitation.id}` || pendingActionKey === `decline-${invitation.id}`}
                                        className="inline-flex items-center justify-center gap-2 border border-[#ffffff0d] bg-[#0f1117] px-4 py-2.5 text-[11px] font-semibold  text-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {pendingActionKey === `decline-${invitation.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                        Decline
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void runDecision(invitation, 'accept')}
                                        disabled={!isPending || pendingActionKey === `accept-${invitation.id}` || pendingActionKey === `decline-${invitation.id}`}
                                        className="inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a]-soft px-4 py-2.5 text-[11px] font-semibold  text-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {pendingActionKey === `accept-${invitation.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Accept
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
