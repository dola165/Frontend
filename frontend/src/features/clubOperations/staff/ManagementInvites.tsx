import { useState } from 'react';
import { Ban, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, EmptyNote, List, ListRow, Panel, SearchInput, Section, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { clubInviteStatusLabel, clubRoleLabel, type ClubManagementOverview, type ClubMembershipInvite, type ClubMembershipRole, type PageResult } from '../../clubs/domain';
import type { UserSearchDto } from '../../../components/workspace/types';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formatDate } from '../../../utils/formatting';
import '../records/records.css';

export interface ManagementInvitesProps {
    overview: ClubManagementOverview | null;
    searchQuery: string; searchResults: PageResult<UserSearchDto> | null; searchLoading: boolean; totalSearchPages: number;
    selectedInviteRole: ClubMembershipRole; pendingKey: string | null; invitedUserIds: Set<number>;
    onSearchQueryChange: (query: string) => void; onSearchPageChange: (page: number) => void; onInviteRoleChange: (role: ClubMembershipRole) => void;
    onInvite: (userId: number) => Promise<void>; onCancelInvite: (inviteId: number) => Promise<void>;
}

const day = (value?: string | null) => value ? formatDate(value, { day: 'numeric', month: 'short' }) : null;

/**
 * Management invitations: broad club membership (admin or coach) for people who run the club. Each invitation is
 * reviewed before it is sent and asked about before it is cancelled. Specialist work uses staff appointments instead.
 */
export function ManagementInvites(p: ManagementInvitesProps) {
    const [confirming, setConfirming] = useState<UserSearchDto | null>(null), [cancelling, setCancelling] = useState<ClubMembershipInvite | null>(null);
    const roles = p.overview?.assignableInviteRoles ?? [];
    const results = p.searchResults;
    const invitations = p.overview?.pendingInvitations ?? [];
    const person = (user: { fullName?: string | null; username: string }) => user.fullName || user.username;

    return <div className="gk-stack">
        {roles.length > 0 ? <Section title="Invite to club management" hint="Broad club access after they accept. For one squad or a specialist role, invite staff instead.">
            <div className="rec-toolbar">
                <SearchInput className="rec-toolbar__search" aria-label="Find a person to invite" placeholder="Name or username" value={p.searchQuery} onChange={event => { p.onSearchQueryChange(event.target.value); p.onSearchPageChange(0); }} />
                <select className="gk-input" aria-label="Invite as" value={p.selectedInviteRole} onChange={event => { setConfirming(null); p.onInviteRoleChange(event.target.value as ClubMembershipRole); }}>
                    {roles.map(role => <option key={role} value={role}>{clubRoleLabel(role)}</option>)}
                </select>
            </div>
            {p.searchQuery.trim().length < 2 ? <p className="gk-faint st-hint">Type at least two characters to search.</p>
                : p.searchLoading ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Searching people"><Skeleton height={44} /><Skeleton height={44} /></div></Panel>
                    : results?.content.length ? <Panel flush footer={results.totalElements > results.pageSize ? <div className="pl-pager st-pager"><span className="gk-muted">Page {results.pageNumber + 1} of {p.totalSearchPages}</span>
                        <div className="gk-row"><Button size="sm" disabled={results.pageNumber === 0} onClick={() => p.onSearchPageChange(Math.max(0, results.pageNumber - 1))}>Previous</Button>
                            <Button size="sm" disabled={results.pageNumber + 1 >= p.totalSearchPages} onClick={() => p.onSearchPageChange(results.pageNumber + 1)}>Next</Button></div></div> : undefined}>
                        <List label="People found">{results.content.map(user => {
                            const member = p.overview?.members.some(m => m.userId === user.id), invited = p.invitedUserIds.has(user.id);
                            return <ListRow key={user.id} lead={<Avatar name={person(user)} size={36} />} title={person(user)} meta={[`@${user.username}`, user.position, user.userType].filter(Boolean).join(' · ')}
                                trail={member ? <Badge>Already a club member</Badge> : invited ? <Badge tone="info">Already invited</Badge>
                                    : <Button size="sm" disabled={p.pendingKey === `invite-${user.id}`} onClick={() => setConfirming(user)}><UserPlus aria-hidden="true" />Review invitation</Button>} />;
                        })}</List>
                    </Panel> : <Panel><EmptyNote title="No one matches this search">Try their full name or username.</EmptyNote></Panel>}
        </Section> : <p className="gk-notice">You can review and cancel pending invitations. Only club leadership can send new ones.</p>}

        <Section title="Sent invitations" hint={invitations.length ? String(invitations.length) : undefined}>
            <Panel flush>{!p.overview ? <div className="cw-skeleton-rows" role="status" aria-label="Loading invitations"><Skeleton height={44} /></div>
                : invitations.length ? <List label="Sent invitations">{invitations.map(invite => <ListRow key={invite.id}
                    lead={<Avatar src={resolveMediaUrl(invite.avatarUrl) || null} name={person(invite)} size={36} />} title={person(invite)}
                    meta={[clubRoleLabel(invite.role), day(invite.createdAt) && `Sent ${day(invite.createdAt)}`, day(invite.expiresAt) && `Expires ${day(invite.expiresAt)}`].filter(Boolean).join(' · ')}
                    trail={<><Badge tone="info">{clubInviteStatusLabel(invite.status)}</Badge><Button size="sm" variant="ghost" iconOnly aria-label={`Cancel the invitation for ${person(invite)}`} title="Cancel invitation"
                        disabled={p.pendingKey === `cancel-${invite.id}`} onClick={() => setCancelling(invite)}><Ban aria-hidden="true" /></Button></>} />)}</List>
                    : <EmptyNote title="No pending management invitations" />}</Panel>
        </Section>

        <Dialog open={confirming !== null} size="sm" title={confirming ? `Invite ${person(confirming)} as ${clubRoleLabel(p.selectedInviteRole).toLowerCase()}?` : ''}
            description={`After they accept, this grants broad club ${p.selectedInviteRole === 'CLUB_ADMIN' ? 'administration' : 'coaching'} access. Use a staff appointment for limited responsibilities.`}
            onClose={() => setConfirming(null)}
            footer={<><Button variant="ghost" disabled={Boolean(p.pendingKey)} onClick={() => setConfirming(null)}>Keep editing</Button>
                <Button variant="primary" disabled={Boolean(p.pendingKey)} onClick={() => { const user = confirming!; void p.onInvite(user.id).then(() => setConfirming(null)); }}>Send management invitation</Button></>} />
        <Dialog open={cancelling !== null} role="alertdialog" size="sm" title={cancelling ? `Cancel the invitation for ${person(cancelling)}?` : ''} description="They can no longer accept it. You can invite them again later."
            onClose={() => setCancelling(null)}
            footer={<><Button variant="ghost" onClick={() => setCancelling(null)}>Keep invitation</Button>
                <Button variant="danger" onClick={() => { const invite = cancelling!; setCancelling(null); void p.onCancelInvite(invite.id); }}>Cancel invitation</Button></>} />
    </div>;
}
