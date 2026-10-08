import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { footballRoles, isProfessionalRole, rolePresentation, type FootballRole, type RoleProfile } from '../features/roles/domain';

const inputClass = 'mt-2 w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2.5 text-sm';

export const FootballRolesPage = () => {
    const { user, sessionId } = useAuth();
    return <FootballRolesEditor key={`${user?.id}-${sessionId}`} />;
};

const FootballRolesEditor = () => {
    const { user, refreshNavigationCapabilities } = useAuth();
    const [search] = useSearchParams();
    const firstUse = search.get('setup') === '1';
    const [profiles, setProfiles] = useState<RoleProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const active = useRef(true);
    const submitting = useRef(false);
    useEffect(() => {
        let current = true;
        active.current = true;
        setLoading(true);
        setError('');
        void apiClient.get<RoleProfile[]>('/users/me/roles').then(response => {
            if (current) { setProfiles(response.data); setLoaded(true); }
        }).catch(err => { if (current) setError(extractApiErrorMessage(err, 'Could not load your football roles.')); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; active.current = false; };
    }, [attempt]);

    const update = (role: FootballRole, values: Partial<RoleProfile>) => {
        setSaved(false);
        setProfiles(current => current.map(profile => profile.role === role ? { ...profile, ...values } : profile));
    };
    const toggle = (role: FootballRole) => {
        setSaved(false);
        setProfiles(current => {
            const remaining = current.filter(profile => profile.role !== role);
            if (remaining.length === current.length) return [...current, { role, primary: current.length === 0, published: false }];
            if (remaining.length && !remaining.some(profile => profile.primary)) remaining[0] = { ...remaining[0], primary: true };
            return remaining;
        });
    };
    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setSaving(true); setError(''); setSaved(false);
        try {
            const response = await apiClient.put<RoleProfile[]>('/users/me/roles', { profiles });
            void refreshNavigationCapabilities().catch(() => undefined);
            if (active.current) { setProfiles(response.data); setSaved(true); }
        } catch (err) {
            if (active.current) setError(extractApiErrorMessage(err, 'Could not save your football roles.'));
        } finally { submitting.current = false; if (active.current) setSaving(false); }
    };

    return <main className="mx-auto max-w-5xl px-4 py-8 text-[var(--fc-text-primary)] sm:px-8">
        <Link to="/account" className="text-sm text-[var(--fc-accent)]">← Account</Link>
        <h1 className="mt-5 text-3xl font-bold">{firstUse ? 'Make your profile yours' : 'Your football roles'}</h1>
        {firstUse && <p className="mt-3">Your account is ready. Add the roles that describe you and complete as much of your profile as you want now.</p>}
        <p className="mt-3 max-w-2xl text-[var(--fc-text-secondary)]">You can be a coach, parent and referee on the same account. Professional roles add a career to your profile. Fans, parents and organization managers can keep a simple introduction.</p>
        {user && <Link to={`/profile/${user.id}?tab=career`} className="mt-3 inline-block text-sm text-[var(--fc-accent)]">View your profile & manage career →</Link>}
        {loading ? <p role="status" className="mt-6">Loading your roles…</p> : <>
            {error && <div role="alert" className="my-5 rounded-lg border border-[color:var(--color-danger)]/40 p-4">{error}{!profiles.length && <button type="button" onClick={() => setAttempt(value => value + 1)} className="ml-3 app-text-action">Retry</button>}</div>}
            {loaded && <form onSubmit={save} className="mt-6 space-y-6">
                <fieldset disabled={saving} className="space-y-6">
                    <legend className="mb-3 font-semibold">Choose your roles</legend>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {footballRoles.map(role => <label key={role} className={`cursor-pointer rounded-xl border p-4 ${profiles.some(profile => profile.role === role) ? 'border-[var(--fc-accent)] bg-[var(--fc-accent-soft)]' : 'border-[var(--fc-border)] bg-[var(--fc-card-bg)]'}`}>
                            <span className="flex items-center gap-2"><input type="checkbox" aria-label={rolePresentation[role].label} aria-describedby={`role-description-${role}`} checked={profiles.some(profile => profile.role === role)} onChange={() => toggle(role)} /><span className="font-semibold">{rolePresentation[role].label}</span></span>
                            <span id={`role-description-${role}`} className="mt-2 block text-xs leading-5 text-[var(--fc-text-secondary)]">{rolePresentation[role].description}</span>
                        </label>)}
                    </div>
                    {profiles.map(profile => <section key={profile.role} aria-label={`${rolePresentation[profile.role].label} details`} className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-5">
                        <h2 className="text-xl font-semibold">{rolePresentation[profile.role].label}</h2>
                        <div className="mt-4 flex flex-wrap gap-5 text-sm">
                            <label className="flex items-center gap-2"><input type="radio" name="primaryRole" checked={profile.primary} onChange={() => { setSaved(false); setProfiles(current => current.map(item => ({ ...item, primary: item.role === profile.role }))); }} />Primary profile role</label>
                            <label className="flex items-center gap-2"><input type="checkbox" checked={profile.published} onChange={event => update(profile.role, { published: event.target.checked })} />Show on my public profile</label>
                        </div>
                        <div className="mt-5 grid gap-5 sm:grid-cols-2">
                            <label className="text-sm">Headline<input maxLength={120} value={profile.headline ?? ''} onChange={event => update(profile.role, { headline: event.target.value })} className={inputClass} /></label>
                            <label className="text-sm">Area you work in<input maxLength={200} value={profile.serviceArea ?? ''} onChange={event => update(profile.role, { serviceArea: event.target.value })} className={inputClass} /></label>
                            <label className="text-sm">{rolePresentation[profile.role].focus}<textarea rows={3} maxLength={1000} value={profile.specialties ?? ''} onChange={event => update(profile.role, { specialties: event.target.value })} className={inputClass} /></label>
                            {(isProfessionalRole(profile.role) || profile.qualifications) && <label className="text-sm">Qualifications summary · self-reported<textarea rows={3} maxLength={1000} value={profile.qualifications ?? ''} onChange={event => update(profile.role, { qualifications: event.target.value })} className={inputClass} /></label>}
                        </div>
                        {rolePresentation[profile.role].destination && <Link to={rolePresentation[profile.role].destination!} className="mt-4 inline-block text-sm text-[var(--fc-accent)]">{profile.role === 'PARENT' ? 'Open Parent Hub' : 'Manage organizations'} →</Link>}
                    </section>)}
                    <p className="text-sm text-[var(--fc-text-secondary)]">Your profile privacy still applies. Qualifications are self-reported. Club appointments are displayed separately using the club’s visibility settings. Access to children, clubs, events and venues comes from confirmed relationships and appointments.</p>
                    <button disabled={saving || !profiles.length} className="rounded-xl bg-[var(--fc-accent)] px-5 py-3 font-semibold text-[color:var(--color-on-accent)] disabled:opacity-50">{saving ? 'Saving…' : 'Save football roles'}</button>
                    {saved && <p role="status" className="text-sm text-[var(--fc-accent)]">Your football roles have been saved.</p>}
                </fieldset>
            </form>}
        </>}
        {firstUse && <nav aria-label="Get started" className="mt-8 flex flex-wrap gap-4 rounded-xl border border-[var(--fc-border)] p-5">
            <Link to="/home" className="font-semibold app-text-action">{saved ? 'Continue to home' : 'Finish later and continue'}</Link>
            <Link to="/clubs" className="app-text-action">Find a club</Link>
            {user?.navigationCapabilities?.workspaces.some(w => w.id === 'organization.create') && <Link to="/organizations/create" className="app-text-action">Create a club or organization</Link>}
            {profiles.some(p => p.role === 'PARENT') && <Link to="/parent" className="app-text-action">Open Parent Hub</Link>}
        </nav>}
    </main>;
};
