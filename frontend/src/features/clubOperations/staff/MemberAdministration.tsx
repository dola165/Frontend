import { useState } from 'react';
import { ExternalLink, Pencil, UserMinus } from 'lucide-react';
import { Badge, Button, ButtonLink, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { clubRoleLabel, isLegacyAgentMembershipRole, type ClubManagedMember, type ClubMembershipRole } from '../../clubs/domain';
import { updateClubStaffProfile } from '../../clubs/api';
import { useClubEditorClose } from '../useClubEditorClose';

export interface MemberAdministrationProps {
    clubId: number; member: ClubManagedMember; assignableRoles: ClubMembershipRole[];
    currentUserId: number | null; currentRole: string | null; canManageLeadership: boolean; pendingKey: string | null;
    onRoleChange: (userId: number, role: ClubMembershipRole) => Promise<void>;
    onRemoveMember: (member: ClubManagedMember) => Promise<void>;
    onProfileSaved?: () => Promise<void>;
}

/**
 * A person's management membership (broad club access, separate from their football appointments) and how they
 * appear on the club's public People tab. Locked roles say why; removing someone asks first.
 */
export function MemberAdministration({ clubId, member, assignableRoles, currentUserId, currentRole, canManageLeadership, pendingKey, onRoleChange, onRemoveMember, onProfileSaved }: MemberAdministrationProps) {
    const name = member.fullName || member.username;
    const self = member.userId === currentUserId;
    const legacyAgent = isLegacyAgentMembershipRole(member.role);
    const [editing, setEditing] = useState(false), [removing, setRemoving] = useState(false);
    const [profile, setProfile] = useState({ title: member.publicTitle || clubRoleLabel(member.role), bio: member.clubBio || '', qualifications: member.qualifications || '', isPublic: member.isPublic !== false });
    const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
    const original = JSON.stringify({ title: member.publicTitle || clubRoleLabel(member.role), bio: member.clubBio || '', qualifications: member.qualifications || '', isPublic: member.isPublic !== false });
    const { requestClose, confirmation } = useClubEditorClose(editing && JSON.stringify(profile) !== original, saving, () => setEditing(false));

    const lockReason = self ? 'Your own role is locked. Use Ownership & access to step away.'
        : member.role === 'OWNER' ? 'Club ownership is protected. Transfer ownership first.'
            : legacyAgent ? 'Legacy agent membership, read only.'
                : currentRole === 'CLUB_ADMIN' && member.role === 'CLUB_ADMIN' ? 'Club admins cannot change other admins.'
                    : member.roleEditable ? null : 'This role is locked by club authority rules.';
    const canRemove = Boolean(currentUserId) && !self && member.role !== 'OWNER' && (currentRole === 'OWNER' ? !legacyAgent : currentRole === 'CLUB_ADMIN' && member.role !== 'CLUB_ADMIN');

    const save = async () => {
        setSaving(true); setError(null);
        try {
            await updateClubStaffProfile(clubId, member.userId, { publicTitle: profile.title.trim() || null, clubBio: profile.bio.trim() || null, qualifications: profile.qualifications.trim() || null, isPublic: profile.isPublic });
            await onProfileSaved?.();
            setEditing(false);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the public profile.'); }
        finally { setSaving(false); }
    };

    return <div className="st-admin">
        <div className="st-admin__row">
            <div className="st-admin__text"><strong>Management access</strong><span className="gk-muted">Administrative membership. Coaching, travel and refereeing duties belong in the appointments above.</span></div>
            <div className="gk-row st-admin__controls">
                {self && <Badge tone="info">You</Badge>}
                {member.roleEditable ? <select className="gk-input" aria-label={`Management access for ${name}`} value={member.role} disabled={pendingKey === `role-${member.userId}`}
                    onChange={event => { const role = event.target.value as ClubMembershipRole; if (role !== member.role) void onRoleChange(member.userId, role); }}>
                    {Array.from(new Set([member.role, ...assignableRoles])).map(role => <option key={role} value={role}>{clubRoleLabel(role)}</option>)}
                </select> : <Badge>{clubRoleLabel(member.role)}</Badge>}
            </div>
        </div>
        {lockReason && !member.roleEditable && <p className="gk-faint st-admin__lock">{lockReason}</p>}

        <div className="st-admin__row">
            <div className="st-admin__text"><strong>Public People profile</strong>
                <span className="gk-muted">{member.isPublic === false ? 'Hidden from the club’s People tab.' : `${member.publicTitle || clubRoleLabel(member.role)} on the club’s People tab.`}</span></div>
            {canManageLeadership && !legacyAgent && !editing && <Button size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Edit public profile</Button>}
        </div>
        {editing && <form className="st-admin__form" aria-label={`Public profile for ${name}`} onSubmit={event => { event.preventDefault(); void save(); }}>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <div className="rec-fields">
                <Field label="Public title" htmlFor={`st-title-${member.userId}`}><input id={`st-title-${member.userId}`} className="gk-input" maxLength={100} value={profile.title} onChange={event => setProfile({ ...profile, title: event.target.value })} disabled={saving} /></Field>
                <Field label={<>Qualifications <span className="rec-optional">(optional)</span></>} htmlFor={`st-qual-${member.userId}`}><input id={`st-qual-${member.userId}`} className="gk-input" maxLength={2000} value={profile.qualifications} onChange={event => setProfile({ ...profile, qualifications: event.target.value })} disabled={saving} /></Field>
                <div className="rec-wide"><Field label={<>Club biography <span className="rec-optional">(optional)</span></>} htmlFor={`st-bio-${member.userId}`}><textarea id={`st-bio-${member.userId}`} className="gk-input" rows={4} maxLength={5000} value={profile.bio} onChange={event => setProfile({ ...profile, bio: event.target.value })} disabled={saving} /></Field></div>
            </div>
            <label className="rec-switch"><span><strong>Show on the public People tab</strong></span><input type="checkbox" role="switch" className="gk-switch" checked={profile.isPublic} onChange={event => setProfile({ ...profile, isPublic: event.target.checked })} disabled={saving} /></label>
            {confirmation}
            <div className="gk-row st-admin__form-actions">
                <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
                <Button variant="ghost" disabled={saving} onClick={requestClose}>Cancel</Button>
                <ButtonLink variant="ghost" to={`/clubs/${clubId}?tab=people`} target="_blank" rel="noreferrer">Preview<ExternalLink aria-hidden="true" /></ButtonLink>
            </div>
        </form>}

        {canRemove && <div className="st-admin__row">
            <div className="st-admin__text"><strong>Remove from the club</strong><span className="gk-muted">Ends their management membership. Their football appointments are ended separately.</span></div>
            <Button size="sm" variant="danger" disabled={pendingKey === `remove-${member.userId}`} onClick={() => setRemoving(true)}><UserMinus aria-hidden="true" />Remove {name}</Button>
        </div>}
        <Dialog open={removing} role="alertdialog" size="sm" title={`Remove ${name} from the club?`} description="They lose management access straight away. This cannot be undone here; invite them again to restore access."
            onClose={() => setRemoving(false)}
            footer={<><Button variant="ghost" onClick={() => setRemoving(false)}>Keep {name}</Button><Button variant="danger" onClick={() => { setRemoving(false); void onRemoveMember(member); }}>Remove from club</Button></>} />
    </div>;
}
