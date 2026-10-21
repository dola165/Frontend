import { JevAdvice } from '../jev/JevAdvice';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Award, BriefcaseBusiness, CalendarDays, GraduationCap, HeartHandshake, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { isProfessionalRole, roleLabel, type CareerEntry, type CareerKind, type ClubAppointment, type FootballProfile } from './domain';
import './professional-career.css';

const kinds = {
    POSITION: { label: 'Experience', icon: BriefcaseBusiness },
    QUALIFICATION: { label: 'Qualifications & development', icon: GraduationCap },
    ACHIEVEMENT: { label: 'Achievements', icon: Award },
    VOLUNTEERING: { label: 'Volunteering', icon: HeartHandshake },
};
const month = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const dates = (entry: CareerEntry) => entry.kind === 'QUALIFICATION'
    ? `Awarded ${month(entry.startsOn)}${entry.endsOn ? ` · Valid until ${month(entry.endsOn)}` : ''}`
    : `${month(entry.startsOn)}${entry.endsOn ? ` – ${month(entry.endsOn)}` : entry.kind === 'POSITION' || entry.kind === 'VOLUNTEERING' ? ' – Present' : ''}`;

export function ClubAppointments({ appointments }: { appointments: ClubAppointment[] }) {
    if (!appointments.length) return null;
    return <section className="career-card" aria-label="Current club appointments">
        <div className="career-section-heading"><BriefcaseBusiness size={19} /><div><h2>Current club appointments</h2><p>Roles and teams recorded by clubs and academies.</p></div></div>
        {appointments.map(item => <article className="career-appointment" key={`${item.clubId}:${item.role}`}>
            <div className="career-club-identity">
                <span className="career-club-logo">{item.logoUrl ? <MediaImage src={resolveMediaUrl(item.logoUrl)} alt="" /> : item.clubName.slice(0, 2)}</span>
                <div><h3>{item.title}</h3><Link to={`/clubs/${item.clubId}`}>{item.clubName}</Link></div>
            </div>
            <div className="career-tags"><span>{item.role === 'OWNER' ? 'Owner' : item.role === 'CLUB_ADMIN' ? 'Club management' : roleLabel(item.role)}</span>{item.coaching && item.role !== 'COACH' && <span>Coach</span>}</div>
            {item.memberSince && <p className="career-meta">{item.role === 'CLUB_STAFF' ? 'Appointment since' : 'Club member since'} {month(item.memberSince)}</p>}
            {!!item.squads.length && <div className="career-squads"><span className="career-eyebrow">{item.coaching ? 'Coaching teams' : 'Assigned teams'}</span><div>{item.squads.map(squad => <span key={squad}>{squad}</span>)}</div></div>}
            {item.biography && <p className="career-prose">{item.biography}</p>}
            {item.qualifications && <div className="career-credential"><span className="career-eyebrow">Qualifications · club-provided</span><p className="career-prose">{item.qualifications}</p><small>Credential verification has not been recorded.</small></div>}
        </article>)}
    </section>;
}

export function ProfessionalCareer({ initial, userId, own, compact = false, showEmpty = true, onChanged }: {
    initial: FootballProfile; userId: number; own: boolean; compact?: boolean; showEmpty?: boolean; onChanged?: (profile: FootballProfile) => void;
}) {
    const [profile, setProfile] = useState(initial);
    const [editing, setEditing] = useState<CareerEntry | 'new' | null>(null);
    const [filter, setFilter] = useState('ALL');
    const [removing, setRemoving] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const pending = useRef(false);
    const roles = profile.roles.filter(isProfessionalRole);
    const entries = profile.entries.filter(entry => filter === 'ALL' || entry.role === filter);
    const accept = (updated: FootballProfile) => { setProfile(updated); onChanged?.(updated); };
    const remove = async (entry: CareerEntry) => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError('');
        try {
            const response = await apiClient.delete<FootballProfile>(`/users/me/career/${entry.id}`);
            accept(response.data); setRemoving(null); setNotice('Career entry removed.');
        } catch (reason) { setError(extractApiErrorMessage(reason, 'Could not remove this entry. Please try again.')); }
        finally { pending.current = false; setBusy(false); }
    };
    return <div className="professional-career">
        {compact ? <>
            <ClubAppointments appointments={profile.appointments} />
            <section className="career-card career-overview" aria-label="Career overview">
                <div><span className="career-eyebrow">Football background</span><h2>{roles.length === 1 && roles[0] === 'COACH' ? 'Coaching career' : 'Career & qualifications'}</h2>
                    <p>{profile.entries.length ? 'Experience, qualifications and achievements across a life in football.' : 'Explore football experience, qualifications and professional activity.'}</p></div>
                <Link className="career-button" to={`/profile/${userId}?tab=career`}>{own ? 'View & edit career' : 'View career'} →</Link>
            </section>
        </> : <>
            <header className="career-card career-intro">
                <div className="career-section-heading"><GraduationCap size={23} /><div><span className="career-eyebrow">Football background</span><h2>Career & qualifications</h2><p>Experience, learning and contributions to the game.</p></div></div>
                {own && <button className="career-button career-primary" disabled={editing !== null} onClick={() => { setEditing('new'); setNotice(''); }}><Plus size={16} /> Add career entry</button>}
            </header>
            <ClubAppointments appointments={profile.appointments} />
            {own && editing !== null && <CareerEntryForm key={editing === 'new' ? 'new' : editing.id} entry={editing === 'new' ? undefined : editing} roles={roles}
                onCancel={() => setEditing(null)} onSaved={updated => { accept(updated); setEditing(null); setNotice('Career entry saved.'); }} />}
            {notice && <p className="career-feedback" role="status">{notice}</p>}
            {error && <p className="career-error" role="alert">{error}</p>}
            {roles.length > 1 && <nav className="career-filters" aria-label="Filter career by role">{['ALL', ...roles].map(role => <button key={role} aria-pressed={filter === role} onClick={() => setFilter(role)}>{role === 'ALL' ? 'All roles' : roleLabel(role)}</button>)}</nav>}
            {showEmpty && !entries.length && <section className="career-card career-empty"><CalendarDays size={28} /><h3>{own ? 'Tell your football story' : 'No career entries published yet'}</h3><p>{own ? 'Add previous positions, qualifications, achievements or volunteering. Save a draft or publish when you are ready.' : 'Published experience and qualifications will appear here.'}</p>{own && <Link to="/account/roles">Manage your football roles →</Link>}</section>}
            {(Object.keys(kinds) as CareerKind[]).map(kind => {
                const items = entries.filter(entry => entry.kind === kind);
                if (!items.length) return null;
                const Icon = kinds[kind].icon;
                return <section className="career-card" aria-label={kinds[kind].label} key={kind}>
                    <div className="career-section-heading"><Icon size={19} /><h2>{kinds[kind].label}</h2></div>
                    <ol className="career-timeline">{items.map(entry => <li key={entry.id}>
                        <div className="career-entry-top"><div><span className="career-eyebrow">{roleLabel(entry.role)}</span><h3>{entry.title}</h3>{entry.organization && <p className="career-organization">{entry.organization}</p>}</div>
                            {own && <div className="career-entry-actions"><button aria-label={`Edit ${entry.title}`} disabled={busy || editing !== null} onClick={() => setEditing(entry)}><Pencil size={16} /></button><button aria-label={`Remove ${entry.title}`} disabled={busy} onClick={() => setRemoving(entry.id)}><Trash2 size={16} /></button></div>}
                        </div>
                        <p className="career-meta">{dates(entry)}</p>
                        {entry.description && <p className="career-prose">{entry.description}</p>}
                        <div className="career-tags"><span>Self-reported</span>{own && <span>{!profile.roles.includes(entry.role) ? 'Hidden · role not published' : entry.published ? 'Published' : 'Draft · only you'}</span>}{entry.kind === 'QUALIFICATION' && entry.endsOn && entry.endsOn < new Date().toLocaleDateString('en-CA') && <span>Renewal date passed</span>}</div>
                        {own && removing === entry.id && <div className="career-confirm" role="group" aria-label={`Confirm removal of ${entry.title}`}><p>Remove this career entry?</p><button className="career-button" disabled={busy} onClick={() => void remove(entry)}>{busy ? 'Removing…' : 'Remove entry'}</button><button className="career-button" disabled={busy} onClick={() => setRemoving(null)}>Keep entry</button></div>}
                    </li>)}</ol>
                    {kind === 'QUALIFICATION' && <p className="career-meta">Qualifications are self-reported. Listing a licence does not verify it or confirm eligibility for an appointment.</p>}
                </section>;
            })}
        </>}
    </div>;
}

function CareerEntryForm({ entry, roles, onSaved, onCancel }: { entry?: CareerEntry; roles: string[]; onSaved: (profile: FootballProfile) => void; onCancel: () => void }) {
    const [values, setValues] = useState<Omit<CareerEntry, 'id'>>(entry ?? { role: roles[0] ?? 'COACH', kind: 'POSITION', title: '', organization: '', startsOn: '', endsOn: '', description: '', published: false });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef(false);
    const roleOptions = [...new Set([...roles, ...(entry ? [entry.role] : [])])];
    const update = (change: Partial<typeof values>) => setValues(current => ({ ...current, ...change }));
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (pending.current) return;
        if (!values.title.trim()) { setError('Enter a title for this career entry.'); return; }
        if (values.endsOn && values.endsOn < values.startsOn) { setError('The end date must be on or after the start date.'); return; }
        pending.current = true; setSaving(true); setError('');
        const payload = { ...values, title: values.title.trim(), endsOn: values.endsOn || null };
        try {
            const response = entry ? await apiClient.put<FootballProfile>(`/users/me/career/${entry.id}`, payload) : await apiClient.post<FootballProfile>('/users/me/career', payload);
            onSaved(response.data);
        } catch (reason) { setError(extractApiErrorMessage(reason, 'Could not save your career entry. Your draft is still here.')); }
        finally { pending.current = false; setSaving(false); }
    };
    return <form className="career-card career-form" onSubmit={submit} aria-label={entry ? 'Edit career entry' : 'Add career entry'}>
        <h2>{entry ? 'Edit career entry' : 'Add career entry'}</h2>
        <p className="career-meta">Share the details that help people understand your work in football.</p>
        <fieldset disabled={saving}>
            <div className="career-form-grid">
                <label>Football role<select value={values.role} required onChange={event => update({ role: event.target.value })}>{roleOptions.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
                <label>Type of entry<select value={values.kind} onChange={event => update({ kind: event.target.value as CareerKind })}>{Object.entries(kinds).map(([key, kind]) => <option key={key} value={key}>{kind.label}</option>)}</select></label>
                <label className="career-field-wide">{values.kind === 'QUALIFICATION' ? 'Qualification or course' : 'Title'}<input autoFocus required maxLength={160} value={values.title} onChange={event => update({ title: event.target.value })} placeholder={values.kind === 'QUALIFICATION' ? 'e.g. Coaching diploma or development course' : 'e.g. Academy development coach'} /></label>
                <label className="career-field-wide">{values.kind === 'QUALIFICATION' ? 'Awarding organization' : 'Club or organization'}<input maxLength={200} value={values.organization ?? ''} onChange={event => update({ organization: event.target.value })} /></label>
                <label>{values.kind === 'QUALIFICATION' ? 'Awarded on' : 'Start date'}<input required type="date" max={new Date().toLocaleDateString('en-CA')} value={values.startsOn} onChange={event => update({ startsOn: event.target.value })} /></label>
                <label>{values.kind === 'QUALIFICATION' ? 'Valid until (optional)' : 'End date (optional)'}<input type="date" min={values.startsOn || undefined} value={values.endsOn ?? ''} onChange={event => update({ endsOn: event.target.value })} /></label>
                <label className="career-field-wide">Description<textarea rows={4} maxLength={2000} value={values.description ?? ''} onChange={event => update({ description: event.target.value })} placeholder="Responsibilities, age groups, learning or achievements" /></label>
            </div>
            <label className="career-checkbox"><input type="checkbox" checked={values.published} onChange={event => update({ published: event.target.checked })} />Publish on my profile</label>
            <JevAdvice endpoint="/jev/career" kind="career" input={{ title: values.title, description: values.description ?? '' }} disabled={saving || !values.title.trim() || !roleOptions.length} onApply={value => { if (Object.hasOwn(kinds, value)) update({ kind: value as CareerKind }); }} />
            <p className="career-meta">Your profile privacy and role visibility still apply. These details are self-reported and do not grant club access or verify a qualification.</p>
            {error && <p role="alert" className="career-error">{error}</p>}
            <div className="career-form-actions"><button className="career-button career-primary" disabled={!roleOptions.length}>{saving ? 'Saving…' : 'Save entry'}</button><button type="button" className="career-button" onClick={onCancel}>Cancel</button></div>
            {!roleOptions.length && <Link to="/account/roles">Add a professional football role first →</Link>}
        </fieldset>
    </form>;
}
