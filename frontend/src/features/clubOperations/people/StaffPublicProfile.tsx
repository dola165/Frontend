import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button, ButtonLink, Field } from '../../../design/primitives';
import { clubRoleLabel, type ClubManagedMember } from '../../clubs/domain';
import { updateClubStaffProfile } from '../../clubs/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useClubEditorClose } from '../useClubEditorClose';
import { useJobWords } from './jobWords';

/** How a club member appears on the club's public People tab: title, qualifications, biography, shown or hidden. */
export function StaffPublicProfile({ clubId, member, onSaved, onClose }: { clubId: number; member: ClubManagedMember; onSaved: () => void; onClose: () => void }) {
    const { copy } = useJobWords();
    const start = { title: member.publicTitle || clubRoleLabel(member.role), bio: member.clubBio || '', qualifications: member.qualifications || '', isPublic: member.isPublic !== false };
    const [profile, setProfile] = useState(start), [saving, setSaving] = useState(false), [error, setError] = useState('');
    const { requestClose, confirmation } = useClubEditorClose(JSON.stringify(profile) !== JSON.stringify(start), saving, onClose);
    const field = (key: string) => `pp-profile-${key}-${member.userId}`;
    const save = async () => {
        setSaving(true); setError('');
        try {
            await updateClubStaffProfile(clubId, member.userId, { publicTitle: profile.title.trim() || null, clubBio: profile.bio.trim() || null, qualifications: profile.qualifications.trim() || null, isPublic: profile.isPublic });
            onSaved();
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('The public profile couldn’t be saved.', 'საჯარო პროფილი ვერ შეინახა.'))); }
        finally { setSaving(false); }
    };
    return <form className="pp-edit" aria-label={copy('Public profile', 'საჯარო პროფილი')} onSubmit={event => { event.preventDefault(); void save(); }}>
        <Field label={copy('Public title', 'საჯარო თანამდებობა')} htmlFor={field('title')}><input id={field('title')} className="gk-input" maxLength={100} value={profile.title} disabled={saving} onChange={event => setProfile({ ...profile, title: event.target.value })} /></Field>
        <Field label={copy('Qualifications (optional)', 'კვალიფიკაცია (არასავალდებულო)')} htmlFor={field('qualifications')}><input id={field('qualifications')} className="gk-input" maxLength={2000} value={profile.qualifications} disabled={saving} onChange={event => setProfile({ ...profile, qualifications: event.target.value })} /></Field>
        <Field label={copy('Club biography (optional)', 'ბიოგრაფია (არასავალდებულო)')} htmlFor={field('bio')}><textarea id={field('bio')} className="gk-input" rows={3} maxLength={5000} value={profile.bio} disabled={saving} onChange={event => setProfile({ ...profile, bio: event.target.value })} /></Field>
        <label className="pp-tool"><input type="checkbox" checked={profile.isPublic} disabled={saving} onChange={event => setProfile({ ...profile, isPublic: event.target.checked })} />
            <span>{copy('Show on the club’s public People tab', 'გამოჩნდეს კლუბის საჯარო გვერდზე')}</span></label>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {confirmation}
        <div className="gk-row pp-edit__actions">
            <Button type="submit" size="sm" variant="primary" disabled={saving}>{saving ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={requestClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <ButtonLink size="sm" variant="ghost" to={`/clubs/${clubId}?tab=people`} target="_blank" rel="noreferrer">{copy('Preview', 'ნახვა')}<ExternalLink aria-hidden="true" /></ButtonLink>
        </div>
    </form>;
}
