import { useState } from 'react';
import { Link2, Pencil, Plus, UserRound } from 'lucide-react';
import { Avatar, Badge, Button } from '../../../design/primitives';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { ClubManagedMember } from '../../clubs/domain';
import { changeJob, draftOf, type InviteLink, type JobDraft, type Person, type PersonJob, type PeopleView } from './api';
import { InviteLinkBox } from './InviteLinkBox';
import { JobPicker } from './JobPicker';
import { StaffPublicProfile } from './StaffPublicProfile';
import { useJobWords } from './jobWords';

/**
 * One person: their jobs and where, each changeable in place by an admin. Someone invited shows "Invited" with
 * New link, and Copy and WhatsApp once a link exists in this session. A head coach's helper shows who added it,
 * with Undo for admins. A club member's public People-tab profile is edited here too.
 */
export function PersonRow({ club, clubName, view, person, member, link, busy, onNewLink, onHideLink, onAddJob, onEnd, onChanged }: {
    club: number; clubName: string; view: PeopleView; person: Person; member?: ClubManagedMember; link?: InviteLink; busy: boolean;
    onNewLink: () => void; onHideLink: () => void; onAddJob: () => void; onEnd: (job: PersonJob) => void; onChanged: (notice: string) => void;
}) {
    const { copy, jobLabel, whereLabel, statusLabel } = useJobWords([...view.jobs, ...view.moreJobs]);
    const { leader, owner, userId: me } = view.viewer;
    const [profile, setProfile] = useState(false);
    const [editing, setEditing] = useState<PersonJob | null>(null), [draft, setDraft] = useState<JobDraft | null>(null);
    const [saving, setSaving] = useState(false), [error, setError] = useState('');
    const invited = person.jobs.some(job => job.status === 'INVITED' || job.status === 'EXPIRED');
    const canLink = person.needsLink && invited && (leader || person.jobs.some(job => job.addedById === me && job.kind === 'APPOINTMENT'));
    const canEnd = (job: PersonJob) => leader && job.kind !== 'OWNER' && person.userId !== me && (job.kind !== 'ADMIN' || owner);
    const endText = (job: PersonJob) => job.kind === 'ADMIN_INVITE' || job.kind === 'COACH_INVITE' || job.status === 'INVITED' || job.status === 'EXPIRED'
        ? copy('Cancel invite', 'მოწვევის გაუქმება') : job.kind === 'APPOINTMENT' ? copy('End job', 'დასრულება') : copy('Remove', 'მოხსნა');
    const jobsText = person.jobs.map(job => `${jobLabel(job)} · ${whereLabel(job)}`).join('; ');
    const edit = (job: PersonJob) => { setEditing(job); setDraft(draftOf(job)); setError(''); };
    const save = async () => {
        if (!editing || !draft) return;
        if (draft.job !== 'ADMIN' && !draft.clubWide && !draft.squadIds.length) { setError(copy('Choose where the job applies.', 'აირჩიეთ, სად ვრცელდება სამუშაო.')); return; }
        setSaving(true); setError('');
        try {
            await changeJob(club, editing, draft);
            setEditing(null); setDraft(null);
            onChanged(person.needsLink ? copy('Job changed.', 'სამუშაო შეიცვალა.') : copy(`Sent to ${person.name} to accept. Their earlier tools pause until then.`, `გაეგზავნა ${person.name}-ს დასადასტურებლად. მანამდე ძველი ხელსაწყოები შეჩერებულია.`));
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('The job couldn’t be changed.', 'სამუშაო ვერ შეიცვალა.'))); }
        finally { setSaving(false); }
    };
    return <li className="pp-person">
        <div className="pp-person__head">
            <Avatar src={resolveMediaUrl(person.avatarUrl) || null} name={person.name} size={40} />
            <div className="pp-person__who">
                <strong className="pp-person__name">{person.name}{person.userId === me && <Badge tone="info">{copy('You', 'თქვენ')}</Badge>}</strong>
                {person.email && person.needsLink && <span className="gk-muted pp-person__email">{person.email}</span>}
            </div>
        </div>
        <div className="pp-person__actions">
            {canLink && <Button size="sm" disabled={busy} onClick={onNewLink}><Link2 aria-hidden="true" />{copy('New link', 'ახალი ბმული')}</Button>}
            {leader && person.userId !== me && <Button size="sm" variant="ghost" disabled={busy} onClick={onAddJob}><Plus aria-hidden="true" />{copy('Add job', 'სამუშაოს დამატება')}</Button>}
            {leader && member && !profile && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setProfile(true)}><UserRound aria-hidden="true" />{copy('Public profile', 'საჯარო პროფილი')}</Button>}
        </div>
        <ul className="pp-jobs" aria-label={copy(`${person.name}’s jobs`, `${person.name}: სამუშაოები`)}>{person.jobs.map(job => {
            const status = statusLabel(job.status);
            return <li key={`${job.kind}-${job.id}`} className="pp-job">
                <span className="pp-job__what"><span className="pp-job__name">{jobLabel(job)}</span><span className="pp-job__where">{whereLabel(job)}</span></span>
                {status && <Badge tone={job.status === 'INVITED' ? 'warning' : job.status === 'UNAVAILABLE' ? 'danger' : 'neutral'}>{status}</Badge>}
                {job.addedByHeadCoach && <span className="gk-faint pp-job__by">{copy(`Added by ${job.addedByName ?? 'a head coach'}`, `დაამატა ${job.addedByName ?? 'მთავარმა მწვრთნელმა'}`)}</span>}
                <span className="pp-job__actions">
                    {leader && job.kind === 'APPOINTMENT' && person.userId !== me && <Button size="sm" variant="ghost" disabled={busy || saving} onClick={() => edit(job)}><Pencil aria-hidden="true" />{copy('Change', 'შეცვლა')}</Button>}
                    {canEnd(job) && <Button size="sm" variant="ghost" className="pp-danger" disabled={busy || saving} onClick={() => onEnd(job)}>{job.addedByHeadCoach ? copy('Undo', 'გაუქმება') : endText(job)}</Button>}
                </span>
                {job.unavailableReason && <p className="gk-faint pp-job__reason">{job.unavailableReason}</p>}
            </li>;
        })}</ul>
        {profile && member && <StaffPublicProfile clubId={club} member={member} onClose={() => setProfile(false)}
            onSaved={() => { setProfile(false); onChanged(copy('Public profile saved.', 'საჯარო პროფილი შეინახა.')); }} />}
        {link && <InviteLinkBox name={person.name} link={link} onClose={onHideLink}
            message={copy(`You’re invited to ${clubName}: ${jobsText}. Choose your password here:`, `მოწვეული ხართ ${clubName}-ში: ${jobsText}. აირჩიეთ პაროლი აქ:`)} />}
        {editing && draft && <form className="pp-edit" aria-label={copy(`Change ${jobLabel(editing)}`, `შეცვლა: ${jobLabel(editing)}`)} onSubmit={event => { event.preventDefault(); void save(); }}>
            <JobPicker view={view} draft={draft} onChange={setDraft} headCoachOnly={false} allowAdmin={false} disabled={saving} />
            {!person.needsLink && <p className="gk-faint">{copy(`${person.name} accepts the change before it applies.`, `ცვლილება ძალაში შევა, როცა ${person.name} დაადასტურებს.`)}</p>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <div className="gk-row pp-edit__actions">
                <Button type="submit" size="sm" variant="primary" disabled={saving}>{saving ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setEditing(null); setDraft(null); }}>{copy('Cancel', 'გაუქმება')}</Button>
            </div>
        </form>}
    </li>;
}
