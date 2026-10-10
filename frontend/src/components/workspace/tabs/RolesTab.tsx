import { useState } from 'react';
import { Briefcase, Crown, LogOut } from 'lucide-react';
import type { ClubManagedMember, ClubManagementOverview } from '../../../features/clubs/domain';
import { clubRoleLabel } from '../../../features/clubs/domain';
import { useAuth } from '../../../context/AuthContext';
import { Avatar, Badge, Button, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section } from '../../../design/primitives';
import '../../../features/clubOperations/records/records.css';

interface RolesTabProps {
    overview: ClubManagementOverview;
    currentUserId: number | null;
    currentRole: string | null;
    pendingKey: string | null;
    confirmingOwnershipTransferUserId: number | null;
    confirmingSelfLeave: boolean;
    isOwner: boolean;
    onConfirmOwnershipTransfer: (userId: number | null) => void;
    onTransferOwnership: (member: ClubManagedMember) => Promise<void>;
    onConfirmSelfLeave: (v: boolean) => void;
    onLeaveClub: () => Promise<void>;
    onOpenJobs?: () => void;
}

/** Your club role, handing ownership to an eligible organiser, and ending your own staff membership. */
export const RolesTab = ({ overview, pendingKey, currentUserId, confirmingSelfLeave, isOwner, onTransferOwnership, onConfirmSelfLeave, onLeaveClub, onOpenJobs }: RolesTabProps) => {
    const { refreshNavigationCapabilities } = useAuth();
    const [transferTo, setTransferTo] = useState<ClubManagedMember | null>(null);
    const endStaffMembership = async () => { await onLeaveClub(); await refreshNavigationCapabilities().catch(() => undefined); };
    // Only staff the server marks as eligible (active organisers with complete accounts) are offered.
    const candidates = overview.members.filter(member => member.ownershipTransferEligible === true && member.userId !== currentUserId && (member.role === 'CLUB_ADMIN' || member.role === 'COACH'));
    const target = transferTo && candidates.find(member => member.userId === transferTo.userId);

    return <PageFrame className="rec-page">
        <PageHeader title="Ownership & access" subtitle="Your club role, who can take over the club, and leaving it."
            actions={onOpenJobs && <Button onClick={onOpenJobs}><Briefcase aria-hidden="true" />Post an open role</Button>} />
        <div className="gk-grid gk-grid--split">
            <div className="gk-stack">
                {isOwner && <Section title="Transfer ownership" hint="You stay on as a club admin.">
                    {target && <div className="gk-notice gk-notice--warning rec-prompt" role="group" aria-label="Confirm ownership transfer">
                        <p className="rec-prompt__text"><strong>Transfer ownership to {target.fullName || target.username}?</strong> You lose owner privileges and return to the club page.</p>
                        <Button size="sm" variant="ghost" onClick={() => setTransferTo(null)}>Cancel</Button>
                        <Button size="sm" variant="primary" disabled={pendingKey === `transfer-${target.userId}`} onClick={() => void onTransferOwnership(target)}>Confirm</Button>
                    </div>}
                    <Panel flush>{candidates.length ? <List label="Eligible organisers">{candidates.map(member => <ListRow key={member.userId}
                        lead={<Avatar src={member.avatarUrl} name={member.fullName || member.username} size={36} />} title={member.fullName || member.username} meta={`@${member.username}`}
                        trail={<><Badge>{clubRoleLabel(member.role)}</Badge><Button size="sm" disabled={pendingKey != null} onClick={() => setTransferTo(member)}><Crown aria-hidden="true" />Transfer ownership<span className="gk-visually-hidden"> to {member.fullName || member.username}</span></Button></>} />)}</List>
                        : <EmptyNote title="No eligible members available for ownership transfer.">Ownership can go to an active club admin or coach who has finished setting up their account.</EmptyNote>}</Panel>
                </Section>}
                <Section title="End staff membership">
                    <Panel padded>
                        <div className="gk-stack gk-stack--tight">
                            <p className="gk-muted">{isOwner ? 'Transfer ownership before leaving. The owner cannot leave directly.' : 'This ends your staff access and coaching assignments. Any playing membership and squad places remain.'}</p>
                            {!isOwner && (confirmingSelfLeave
                                ? <div className="gk-row"><Button variant="ghost" onClick={() => onConfirmSelfLeave(false)} disabled={pendingKey === 'leave-club'}>Cancel</Button>
                                    <Button variant="danger" onClick={() => void endStaffMembership()} disabled={pendingKey === 'leave-club'}>{pendingKey === 'leave-club' ? 'Leaving…' : 'Confirm departure'}</Button></div>
                                : <div><Button variant="danger" onClick={() => onConfirmSelfLeave(true)}><LogOut aria-hidden="true" />End staff membership</Button></div>)}
                        </div>
                    </Panel>
                </Section>
            </div>
            <Panel flush title="Your club role">
                <dl className="rec-facts">
                    <div><dt>Your role</dt><dd>{clubRoleLabel(overview.currentUserRole)}</dd></div>
                    <div className="rec-wide"><dt>Roles you can assign</dt><dd className="rec-badges">{overview.assignableStaffRoles.length ? overview.assignableStaffRoles.map(role => <Badge key={role} tone="accent">{clubRoleLabel(role)}</Badge>) : 'None'}</dd></div>
                    <div className="rec-wide"><dt>Leaving</dt><dd>{isOwner ? 'Transfer ownership before you can leave.' : 'You can leave this club when ready.'}</dd></div>
                </dl>
            </Panel>
        </div>
    </PageFrame>;
};
