import { useState } from 'react';
import { Ban, Users } from 'lucide-react';
import { Avatar, Badge, Button, EmptyNote, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { clubInviteStatusLabel, clubRoleLabel, type ClubManagementOverview, type ClubMembershipInvite } from '../../clubs/domain';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formatDate } from '../../../utils/formatting';

const day = (value?: string | null) => value ? formatDate(value, { day: 'numeric', month: 'short' }) : null;

/**
 * Club invitations still waiting for an answer, each cancellable after asking. Giving someone a job is the invite on
 * People; this list keeps the older membership invitations (players included) visible until they are answered.
 */
export function SentInvitations({ overview, pendingKey, onCancelInvite, onOpenPeople }: {
    overview: ClubManagementOverview | null; pendingKey: string | null; onCancelInvite: (inviteId: number) => Promise<void>; onOpenPeople?: () => void;
}) {
    const [cancelling, setCancelling] = useState<ClubMembershipInvite | null>(null);
    const invitations = overview?.pendingInvitations ?? [];
    const person = (user: { fullName?: string | null; username: string }) => user.fullName || user.username;
    return <div className="gk-stack">
        <Section title="Sent invitations" hint={invitations.length ? String(invitations.length) : undefined}>
            <Panel flush>{!overview ? <div className="cw-skeleton-rows" role="status" aria-label="Loading invitations"><Skeleton height={44} /></div>
                : invitations.length ? <List label="Sent invitations">{invitations.map(invite => <ListRow key={invite.id}
                    lead={<Avatar src={resolveMediaUrl(invite.avatarUrl) || null} name={person(invite)} size={36} />} title={person(invite)}
                    meta={[clubRoleLabel(invite.role), day(invite.createdAt) && `Sent ${day(invite.createdAt)}`, day(invite.expiresAt) && `Expires ${day(invite.expiresAt)}`].filter(Boolean).join(' · ')}
                    trail={<><Badge tone="info">{clubInviteStatusLabel(invite.status)}</Badge><Button size="sm" variant="ghost" iconOnly aria-label={`Cancel the invitation for ${person(invite)}`} title="Cancel invitation"
                        disabled={pendingKey === `cancel-${invite.id}`} onClick={() => setCancelling(invite)}><Ban aria-hidden="true" /></Button></>} />)}</List>
                    : <EmptyNote title="No invitations waiting" action={onOpenPeople ? <Button size="sm" onClick={onOpenPeople}><Users aria-hidden="true" />Open People</Button> : undefined}>
                        Invite coaches and staff from People.</EmptyNote>}</Panel>
        </Section>
        <Dialog open={cancelling !== null} role="alertdialog" size="sm" title={cancelling ? `Cancel the invitation for ${person(cancelling)}?` : ''} description="They can no longer accept it. You can invite them again later."
            onClose={() => setCancelling(null)}
            footer={<><Button variant="ghost" onClick={() => setCancelling(null)}>Keep invitation</Button>
                <Button variant="danger" onClick={() => { const invite = cancelling; setCancelling(null); if (invite) void onCancelInvite(invite.id); }}>Cancel invitation</Button></>} />
    </div>;
}
