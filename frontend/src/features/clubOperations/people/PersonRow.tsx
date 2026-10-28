import { useState } from 'react';
import { Crown, DoorOpen, History, Link2, Pencil, Plus, UserRound } from 'lucide-react';
import { Avatar, Badge, Button } from '../../../design/primitives';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { relativeTime } from '../../../utils/relativeTime';
import type { ClubManagedMember } from '../../clubs/domain';
import { changeJob, draftOf, mainJobs, type InviteLink, type JobDraft, type Person, type PersonJob, type PeopleView } from './api';
import { InviteLinkBox } from './InviteLinkBox';
import { JobPicker } from './JobPicker';
import { StaffPublicProfile } from './StaffPublicProfile';
import { useJobWords } from './jobWords';

/** What the viewer may do to other people's jobs, from the rule-checker (or the People view's flags on older servers). */
/** `pending`: the rule-checker has not answered yet; the buttons show, disabled, until it has. */
export interface PeopleRights { change: boolean; end: boolean; invite: boolean; pending?: boolean }
/** A squad job changes into another job in place; making someone an Admin is Add job (an invitation of its own). */


/**
 * One person: their jobs and where. The Owner and Admins change or end anyone's job in place (never the Owner's); the
 * change applies at once and its line says who made it, with the whole story under History. Someone invited shows
 * "Invited" with New link, and Copy and WhatsApp once a link exists in this session. A club member's public People-tab
 * profile is edited here too.
 */
export function PersonRow({ club, clubName, view, person, member, link, busy, rights, onNewLink, onHideLink, onAddJob, onEnd, onLeave, onChanged }: {
    club: number; clubName: string; view: PeopleView; person: Person; member?: ClubManagedMember; link?: InviteLink; busy: boolean; rights: PeopleRights;
    onNewLink: () => void; onHideLink: () => void; onAddJob: () => void; onEnd: (job: PersonJob) => void; onLeave: (step: 'leave' | 'handover') => void; onChanged: (notice: string) => void;
}) {
    const { copy, jobLabel, whereLabel, statusLabel, eventLabel } = useJobWords([...view.jobs, ...view.moreJobs]);
    const me = view.viewer.userId, self = person.userId === me;
    const [profile, setProfile] = useState(false), [story, setStory] = useState(false);
    const [editing, setEditing] = useState<PersonJob | null>(null), [draft, setDraft] = useState<JobDraft | null>(null);
    const [saving, setSaving] = useState(false), [error, setError] = useState('');
    const invited = person.jobs.some(job => job.status === 'INVITED' || job.status === 'EXPIRED');
    const canLink = person.needsLink && invited && (rights.invite || person.jobs.some(job => job.addedById === me && job.kind === 'APPOINTMENT'));
    // Each job carries the rule-checker's answer (canChange, canEnd); older answers fall back to the page's rights.
    const canEnd = (job: PersonJob) => (job.canEnd ?? rights.end) && job.kind !== 'OWNER' && !self;
    // Your own lines: the Owner hands the club over; one job among several ends on its own; the last one is leaving the club.
    // Only jobs held now or starting soon count (invited, suggested or expired ones don't); when unsure, the leave flow decides.
    const liveJobs = person.jobs.filter(job => job.status === 'ACTIVE' || job.status === 'UPCOMING').length;
    const ownLeave = (job: PersonJob) => !self || !['ACTIVE', 'UPCOMING'].includes(job.status) ? null
        : job.kind === 'OWNER' ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => onLeave('handover')}><Crown aria-hidden="true" />{copy('Hand the club over', 'კლუბის გადაცემა')}</Button>
            : <Button size="sm" variant="ghost" className="pp-danger" disabled={busy}
                onClick={() => job.kind === 'APPOINTMENT' && liveJobs > 1 ? onEnd(job) : onLeave('leave')}><DoorOpen aria-hidden="true" />{copy('Leave', 'დატოვება')}</Button>;
    const canChange = (job: PersonJob) => (job.canChange ?? rights.change) && job.kind === 'APPOINTMENT' && !self;
    const endText = (job: PersonJob) => job.kind === 'ADMIN_INVITE' || job.kind === 'COACH_INVITE' || job.status === 'INVITED' || job.status === 'EXPIRED'
        ? copy('Cancel invite', 'მოწვევის გაუქმება') : job.kind === 'APPOINTMENT' ? copy('End job', 'დასრულება') : copy('Remove', 'მოხსნა');
    const jobsText = person.jobs.map(job => `${jobLabel(job)} · ${whereLabel(job)}`).join('; ');
    // Every job's events together, newest first (the server sends each job's oldest first).
    const history = person.jobs.flatMap(job => (job.history ?? []).map(event => ({ ...event, job }))).sort((a, b) => b.at.localeCompare(a.at));
    const edit = (job: PersonJob) => { setEditing(job); setDraft(draftOf(job)); setError(''); };
    const save = async () => {
        if (!editing || !draft) return;
        if (draft.job !== 'ADMIN' && !draft.clubWide && !draft.squadIds.length) { setError(copy('Choose where the job applies.', 'აირჩიეთ, სად ვრცელდება სამუშაო.')); return; }
        setSaving(true); setError('');
        try {
            await changeJob(club, editing, draft);
            setEditing(null); setDraft(null);
            const now = `${person.name}: ${jobLabel(draft)} · ${whereLabel({ clubWide: draft.clubWide, squads: view.squads.filter(s => draft.squadIds.includes(s.id)) })}`;
            onChanged(copy(`${now}. Changed now.`, `${now}. შეიცვალა.`));
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('The job couldn’t be changed.', 'სამუშაო ვერ შეიცვალა.'))); }
        finally { setSaving(false); }
    };
    return <li className="pp-person">
        <div className="pp-person__head">
            <Avatar src={resolveMediaUrl(person.avatarUrl) || null} name={person.name} size={40} />
            <div className="pp-person__who">
                <strong className="pp-person__name">{person.name}{self && <Badge tone="info">{copy('You', 'თქვენ')}</Badge>}</strong>
                {view.viewer.leader && person.email && person.needsLink && <span className="gk-muted pp-person__email">{person.email}</span>}
            </div>
        </div>
        <div className="pp-person__actions">
            {canLink && <Button size="sm" disabled={busy || rights.pending} onClick={onNewLink}><Link2 aria-hidden="true" />{copy('New link', 'ახალი ბმული')}</Button>}
            {rights.invite && !self && <Button size="sm" variant="ghost" disabled={busy || rights.pending} onClick={onAddJob}><Plus aria-hidden="true" />{copy('Add job', 'სამუშაოს დამატება')}</Button>}
            {history.length > 0 && <Button size="sm" variant="ghost" aria-expanded={story} onClick={() => setStory(open => !open)}><History aria-hidden="true" />{copy('History', 'ისტორია')}</Button>}
            {rights.invite && member && !profile && <Button size="sm" variant="ghost" disabled={busy || rights.pending} onClick={() => setProfile(true)}><UserRound aria-hidden="true" />{copy('Public profile', 'საჯარო პროფილი')}</Button>}
        </div>
        <ul className="pp-jobs" aria-label={copy(`${person.name}’s jobs`, `${person.name}: სამუშაოები`)}>{person.jobs.map(job => {
            const status = statusLabel(job.status);
            return <li key={`${job.kind}-${job.id}`} className="pp-job">
                <span className="pp-job__what"><span className="pp-job__name">{jobLabel(job)}</span><span className="pp-job__where">{whereLabel(job)}</span></span>
                {status && <Badge tone={job.status === 'INVITED' ? 'warning' : job.status === 'UNAVAILABLE' ? 'danger' : 'neutral'}>{status}</Badge>}
                {job.changedByName && job.changedAt ? <span className="gk-faint pp-job__by">{copy(`Changed by ${job.changedByName} · ${relativeTime(job.changedAt)}`, `შეცვალა ${job.changedByName} · ${relativeTime(job.changedAt)}`)}</span>
                    : job.source === 'STAFF_LINK' ? <span className="gk-faint pp-job__by">{copy('Joined through a staff link', 'შემოვიდა პერსონალის ბმულით')}</span>
                    : job.suggestedByName && <span className="gk-faint pp-job__by">{copy(`Suggested by ${job.suggestedByName}`, `შესთავაზა ${job.suggestedByName}`)}</span>}
                <span className="pp-job__actions">
                    {canChange(job) && <Button size="sm" variant="ghost" disabled={busy || saving || rights.pending} onClick={() => edit(job)}><Pencil aria-hidden="true" />{copy('Change', 'შეცვლა')}</Button>}
                    {canEnd(job) && <Button size="sm" variant="ghost" className="pp-danger" disabled={busy || saving || rights.pending} onClick={() => onEnd(job)}>{endText(job)}</Button>}
                    {ownLeave(job)}
                </span>
                {job.unavailableReason && <p className="gk-faint pp-job__reason">{job.unavailableReason}</p>}
            </li>;
        })}</ul>
        {story && <ol className="pp-history" aria-label={copy(`${person.name}: history`, `${person.name}: ისტორია`)}>{history.map(({ job, ...event }, index) => <li key={`${event.at}-${index}`}>
            <span>{eventLabel(event.action)} · {jobLabel(job)}{event.summary ? `: ${event.summary}` : ''}</span><small className="gk-faint">{event.byName} · {relativeTime(event.at)}</small>
        </li>)}</ol>}
        {profile && member && <StaffPublicProfile clubId={club} member={member} onClose={() => setProfile(false)}
            onSaved={() => { setProfile(false); onChanged(copy('Public profile saved.', 'საჯარო პროფილი შეინახა.')); }} />}
        {link && <InviteLinkBox name={person.name} link={link} onClose={onHideLink}
            message={copy(`You’re invited to ${clubName}: ${jobsText}. Choose your password here:`, `მოწვეული ხართ ${clubName}-ში: ${jobsText}. აირჩიეთ პაროლი აქ:`)} />}
        {editing && draft && <form className="pp-edit" aria-label={copy(`Change ${jobLabel(editing)}`, `შეცვლა: ${jobLabel(editing)}`)} onSubmit={event => { event.preventDefault(); void save(); }}>
            <JobPicker view={view} draft={draft} onChange={setDraft} choices={mainJobs(view).filter(job => job !== 'ADMIN')} extras disabled={saving} />
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <div className="gk-row pp-edit__actions">
                <Button type="submit" size="sm" variant="primary" disabled={saving}>{saving ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setEditing(null); setDraft(null); }}>{copy('Cancel', 'გაუქმება')}</Button>
            </div>
        </form>}
    </li>;
}
