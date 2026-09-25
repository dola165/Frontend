import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Trophy } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { organizationPresentation, type OrganizationProfile, type OrganizationProfileDraft } from '../features/organizations/domain';
import { OrganizationActivitySettings } from '../features/organizations/activities/OrganizationActivitySettings';
import { OrganizationDelegationPanel } from '../features/organizations/activities/OrganizationDelegationPanel';
import { organizationProfileCopy } from '../features/organizations/presentation/copy';
import '../features/organizations/presentation/organization-profile.css';

const draftFrom = (profile: OrganizationProfile): OrganizationProfileDraft => ({
    published: profile.published, displayName: profile.displayName, description: profile.description, website: profile.website,
    publicEmail: profile.publicEmail, publicPhone: profile.publicPhone, addressText: profile.addressText, focus: profile.focus,
});
const safeWebsite = (value: string | null) => {
    if (!value) return null;
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};
const kindLabel = (kind: OrganizationProfile['profileKind'], copy: ReturnType<typeof organizationProfileCopy>) => ({
    VENUE: copy.kindVenue, TOURNAMENT_ORGANIZER: copy.kindTournament, MEDIA: copy.kindMedia, HEALTHCARE: copy.kindHealthcare, SPONSOR: copy.kindSponsor,
    CLUB: copy.kindOrganization, COMPANY: copy.kindOrganization, PARTNER: copy.kindOrganization, SPORTS_ORG: copy.kindOrganization,
}[kind] ?? copy.kindOrganization);

export const OrganizationProfilePage = () => {
    const { organizationId } = useParams(), { sessionId } = useAuth();
    if (!organizationId || !/^\d+$/.test(organizationId) || Number(organizationId) <= 0) return <p role="alert">Organization not found.</p>;
    return <OrganizationProfileContent key={`${organizationId}-${sessionId}`} id={organizationId} />;
};

/** Local fixtures use this entry so no stored authentication is read or changed. */
export const OrganizationProfilePreview = ({ id = '17', presentationOnly = false }: { id?: string; presentationOnly?: boolean }) => <OrganizationProfileContent key={`preview-${id}-${presentationOnly}`} id={id} presentationOnly={presentationOnly} />;

const OrganizationProfileContent = ({ id, presentationOnly = false }: { id: string; presentationOnly?: boolean }) => {
    const [search] = useSearchParams();
    const { i18n } = useTranslation(), copy = organizationProfileCopy(i18n.language);
    const [profile, setProfile] = useState<OrganizationProfile | null>(null);
    const [draft, setDraft] = useState<OrganizationProfileDraft | null>(null);
    const [loading, setLoading] = useState(true), [editing, setEditing] = useState(false), [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(''), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
    const active = useRef(true), submitting = useRef(false);
    useEffect(() => {
        let current = true;
        active.current = true; setLoading(true); setError('');
        void apiClient.get<OrganizationProfile>(`/organizations/${id}`).then(response => {
            if (current) { setProfile(response.data); setDraft(draftFrom(response.data)); }
        }).catch(err => { if (current) setError(extractApiErrorMessage(err, copy.retry)); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; active.current = false; };
    }, [id, attempt, copy.retry]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (!profile?.canEdit || profile.promotionBlocked || !draft || submitting.current) return;
        submitting.current = true; setSaving(true); setError(''); setMessage('');
        try {
            const response = await apiClient.put<OrganizationProfile>(`/organizations/${id}`, draft);
            if (active.current) { setProfile(response.data); setDraft(draftFrom(response.data)); setEditing(false); setMessage(copy.saved); }
        } catch (err) { if (active.current) setError(extractApiErrorMessage(err, copy.retry)); }
        finally { submitting.current = false; if (active.current) setSaving(false); }
    };

    if (loading) return <p role="status" className="org-profile-loading">{copy.loading}</p>;
    if (!profile) return <main className="org-profile-failure"><p role="alert">{error}</p><button type="button" className="org-profile-action" onClick={() => setAttempt(value => value + 1)}>{copy.retry}</button></main>;

    const capabilities = profile.capabilities;
    const blocked = profile.promotionBlocked === true;
    const canEdit = profile.canEdit && !blocked;
    // The legacy profile endpoint exposes editing rights but predates activity capabilities.
    // Only absence enables this navigation fallback; an explicit capability denial stays authoritative.
    const legacyVenue = profile.profileKind === 'VENUE' && !Object.prototype.hasOwnProperty.call(profile, 'capabilities');
    const canOpenVenue = capabilities?.canManageVenueBookings || (legacyVenue && profile.canEdit);
    const canCreateTournament = !legacyVenue && profile.canCreateTournament;
    const settings = capabilities?.canConfigureActivities && search.get('settings') === '1';
    const activitySettings = !presentationOnly && capabilities?.canConfigureActivities && <OrganizationActivitySettings id={profile.id} onChanged={value => setProfile({ ...profile, capabilities: value, canCreateTournament: value.canCreateTournament, canEdit: blocked ? false : value.canEditProfile })} />;
    const delegation = !presentationOnly && capabilities?.canInviteVenueOperator && <OrganizationDelegationPanel id={profile.id} />;

    if (profile.clubId) return settings ? <ClubSettings profile={profile} blocked={blocked} copy={copy} activitySettings={activitySettings} delegation={delegation} /> : <Navigate to={`/clubs/${profile.clubId}`} replace />;
    if (profile.profileKind === 'VENUE' && !canEdit && !capabilities?.canConfigureActivities && !capabilities?.canConfigureVenue && !canOpenVenue && !canCreateTournament)
        return <Navigate to={`/stadiums/${profile.id}`} replace />;

    const presentation = organizationPresentation(profile.profileKind);
    const Icon = profile.profileKind === 'TOURNAMENT_ORGANIZER' ? Trophy : Building2;
    const website = !blocked ? safeWebsite(profile.website) : null;
    const venueAction = canOpenVenue && <Link className="org-profile-action org-profile-action--primary" to={`/stadiums/${profile.id}/manage`}>{copy.venue}</Link>;
    const tournamentAction = canCreateTournament && <Link className={`org-profile-action ${venueAction ? '' : 'org-profile-action--primary'}`} to={`/tournaments/setup?organizer=${profile.id}`}>{copy.tournament}</Link>;
    const configureAction = capabilities?.canConfigureActivities && !venueAction && !tournamentAction && <a className="org-profile-action org-profile-action--settings" href={`#activities-${profile.id}`}>{copy.configure}</a>;
    const publicVenueAction = (capabilities?.venueAvailable || legacyVenue) && !blocked && <Link className="org-profile-action" to={`/stadiums/${profile.id}`}>{copy.publicVenue}</Link>;

    return <main className="organization-activity-page org-profile" style={{ '--org-kind-accent': presentation.accent } as CSSProperties}>
        <Link to="/my-organizations" className="org-profile-back">← {copy.back}</Link>
        <header className="org-profile-header">
            <div><p className="org-profile-kicker"><Icon size={16} />{kindLabel(profile.profileKind, copy)}</p><h1 className="org-profile-title">{profile.displayName}</h1>
                <div className="org-profile-meta">{!blocked && profile.addressText && <span><MapPin size={13} aria-hidden="true" /> {profile.addressText}</span>}<span>{profile.verificationStatus === 'VERIFIED' ? copy.verified : copy.notVerified}</span>{!blocked && <span className="org-profile-status">{profile.published ? copy.published : copy.draft}</span>}</div>
            </div>
            {canEdit && <button type="button" className="org-profile-edit" onClick={() => { setDraft(draftFrom(profile)); setEditing(true); setMessage(''); }}>{copy.edit}</button>}
        </header>
        {(venueAction || tournamentAction || configureAction || publicVenueAction) && <nav className="org-profile-actions" aria-label="Organization actions">{venueAction}{publicVenueAction}{tournamentAction}{configureAction}</nav>}
        {venueAction && <p className="org-profile-notice">{copy.venueOrganizationHelp}</p>}
        {blocked && <section className="org-profile-restriction" role="status"><strong>{copy.restrictedTitle}</strong><p>{copy.restrictedBody}</p></section>}
        {error && <p role="alert" className="org-profile-error">{error}</p>}
        {message && <p role="status" className="org-profile-notice">{message}</p>}
        {editing && draft && !blocked ? <ProfileForm draft={draft} copy={copy} focusLabel={copy.focus} saving={saving} onChange={setDraft} onCancel={() => setEditing(false)} onSubmit={save} /> : !blocked && <section className="org-profile-grid">
            <article className="org-profile-card"><section><h2>{copy.about} {profile.displayName}</h2><p>{profile.description || copy.emptyAbout}</p></section><section><h2>{copy.focus}</h2><p>{profile.focus || copy.emptyFocus}</p></section></article>
            <aside className="org-profile-contact"><h2>{copy.contact}</h2><div className="org-profile-contact-list">{profile.addressText && <p>{profile.addressText}</p>}{website && <a href={website} target="_blank" rel="noopener noreferrer">{copy.website}</a>}{profile.publicEmail && <a href={`mailto:${profile.publicEmail}`}>{profile.publicEmail}</a>}{profile.publicPhone && <a href={`tel:${profile.publicPhone.replace(/[^+\d]/g, '')}`}>{profile.publicPhone}</a>}{!profile.addressText && !website && !profile.publicEmail && !profile.publicPhone && <p>{copy.noContact}</p>}</div></aside>
        </section>}
        {(activitySettings || delegation) && <section className="org-profile-settings"><h2>{copy.settings}</h2>{activitySettings}{delegation}</section>}
    </main>;
};

function ClubSettings({ profile, blocked, copy, activitySettings, delegation }: { profile: OrganizationProfile; blocked: boolean; copy: ReturnType<typeof organizationProfileCopy>; activitySettings: ReactNode; delegation: ReactNode }) {
    return <main className="organization-activity-page org-profile"><Link to={`/clubs/${profile.clubId}`} className="org-profile-back">← {copy.club}</Link><section className="org-profile-settings"><h1>{copy.settings}</h1><p>{copy.settingsHelp}</p>{blocked && <section className="org-profile-restriction" role="status"><strong>{copy.restrictedTitle}</strong><p>{copy.restrictedBody}</p></section>}{activitySettings}{profile.capabilities?.canManageVenueBookings && <Link className="org-profile-action org-profile-action--primary" to={`/stadiums/${profile.id}/manage`}>{copy.venue}</Link>}{delegation}</section></main>;
}

function ProfileForm({ draft, copy, focusLabel, saving, onChange, onCancel, onSubmit }: { draft: OrganizationProfileDraft; copy: ReturnType<typeof organizationProfileCopy>; focusLabel: string; saving: boolean; onChange: (value: OrganizationProfileDraft) => void; onCancel: () => void; onSubmit: (event: FormEvent) => void }) {
    return <form onSubmit={onSubmit} className="org-profile-form"><fieldset disabled={saving}><legend>{copy.editTitle}</legend>
        <label className="org-profile-check org-profile-span"><input type="checkbox" checked={draft.published} onChange={event => onChange({ ...draft, published: event.target.checked })} />{copy.publish}</label>
        <label>{copy.name}<input required maxLength={255} value={draft.displayName} onChange={event => onChange({ ...draft, displayName: event.target.value })} /></label>
        <label>{copy.address}<input maxLength={500} value={draft.addressText ?? ''} onChange={event => onChange({ ...draft, addressText: event.target.value })} /></label>
        <label className="org-profile-span">{copy.description}<textarea rows={4} maxLength={4000} value={draft.description ?? ''} onChange={event => onChange({ ...draft, description: event.target.value })} /></label>
        <label className="org-profile-span">{focusLabel}<textarea rows={4} maxLength={2000} value={draft.focus ?? ''} onChange={event => onChange({ ...draft, focus: event.target.value })} /></label>
        <label>{copy.website}<input type="url" maxLength={500} value={draft.website ?? ''} onChange={event => onChange({ ...draft, website: event.target.value })} /></label>
        <label>{copy.publicEmail}<input type="email" maxLength={254} value={draft.publicEmail ?? ''} onChange={event => onChange({ ...draft, publicEmail: event.target.value })} /></label>
        <label>{copy.publicPhone}<input type="tel" maxLength={60} value={draft.publicPhone ?? ''} onChange={event => onChange({ ...draft, publicPhone: event.target.value })} /></label>
        <div className="org-profile-form-actions"><button className="org-profile-save" disabled={saving || !draft.displayName.trim()}>{saving ? copy.saving : copy.save}</button><button type="button" onClick={onCancel}>{copy.cancel}</button></div>
    </fieldset></form>;
}
