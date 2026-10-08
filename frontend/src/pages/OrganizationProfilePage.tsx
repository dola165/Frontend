import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, Camera, Mail, MapPin, Phone, Settings, ShieldCheck, Trophy, Globe, BriefcaseBusiness, CalendarDays, Banknote } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { ConnectedWork } from '../components/layout/ConnectedWork';
import { MediaImage } from '../components/ui/MediaImage';
import { extractApiErrorMessage } from '../utils/apiError';
import type { OrganizationProfile, OrganizationProfileDraft } from '../features/organizations/domain';
import { OrganizationVenues } from '../features/organizations/presentation/OrganizationVenues';
import { OrganizationBranding } from '../features/organizations/setup/OrganizationBranding';
import '../features/organizations/presentation/organization-profile.css';
import '../features/organizations/presentation/entity-profile.css';

interface Presentation {
  profile: OrganizationProfile;
  branding?: { revision: number; logoUrl?: string; bannerUrl?: string };
  portfolio?: { venues: { id: number; name?: string }[] };
  competitions: { id: number; name: string; status: string }[];
  canOpenWorkspace: boolean;
  membershipRole: string;
}
const safeWebsite = (value: string | null) => {
  if (!value) return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
};
const focusLabels: Record<string, string> = { MEDIA: 'coverage', HEALTHCARE: 'services', SPONSOR: 'partnerships', SPORTS_ORG: 'activities' };
const focusLabel = (kind: string, label: (key: string) => string) => label(focusLabels[kind] ?? 'focus');
const draftFrom = (profile: OrganizationProfile): OrganizationProfileDraft => ({ published: profile.published, displayName: profile.displayName, description: profile.description, website: profile.website, publicEmail: profile.publicEmail, publicPhone: profile.publicPhone, addressText: profile.addressText, focus: profile.focus });

export function OrganizationProfilePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'experience.organization' });
  const { organizationId } = useParams(), { sessionId } = useAuth();
  if (!organizationId || !/^\d+$/.test(organizationId) || !Number.isSafeInteger(Number(organizationId)) || Number(organizationId) <= 0) return <p role="alert">{t('notFound')}</p>;
  return <OrganizationProfileContent key={`${organizationId}:${sessionId}`} id={organizationId} />;
}
export const OrganizationProfilePreview = ({ id = '17' }: { id?: string }) => <OrganizationProfileContent key={id} id={id} />;

function OrganizationProfileContent({ id }: { id: string }) {
  const { t } = useTranslation('translation', { keyPrefix: 'experience.organization' });
  const [search, setSearch] = useSearchParams();
  const [data, setData] = useState<Presentation | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void apiClient.get<Presentation>(`/organizations/${id}/presentation`, { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setData(r.data); })
      .catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, '') || 'loadError'); });
    return () => controller.abort();
  }, [id, attempt]);
  if (!data) return <main className="entity-profile-loading"><Link to="/my-organizations">{t('myOrganizations')}</Link>{error ? <><p role="alert">{error === 'loadError' ? t('loadError') : error}</p><button onClick={() => { setError(''); setAttempt(n => n + 1); }}>{t('retry')}</button></> : <p role="status">{t('loading')}</p>}</main>;
  const p = data.profile;
  if (p.clubId) return <Navigate replace to={`/clubs/${p.clubId}${search.has('tab') ? `?tab=${encodeURIComponent(search.get('tab') ?? '')}` : ''}`} />;
  const blocked = p.promotionBlocked === true, editable = p.canEdit && !blocked;
  const venueCount = new Set(data.portfolio?.venues.map(v => v.id)).size;
  const hasFacilities = !blocked && (venueCount > 0 || p.capabilities?.venueAvailable === true);
  const hasTournaments = !blocked && (data.competitions.length > 0 || p.capabilities?.enabledActivities.includes('TOURNAMENT'));
  const tabs = [{ id: 'overview', label: t('overview'), icon: Building2 }, ...(!blocked && p.focus ? [{ id: 'focus', label: focusLabel(p.profileKind, t), icon: BriefcaseBusiness }] : []), ...(hasFacilities ? [{ id: 'venues', label: t('venues'), icon: Building2 }, { id: 'schedule', label: t('schedule'), icon: CalendarDays }, { id: 'prices', label: t('prices'), icon: Banknote }] : []), ...(hasTournaments ? [{ id: 'tournaments', label: t('tournaments'), icon: Trophy }] : []), ...(!blocked ? [{ id: 'contact', label: t('contact'), icon: Phone }] : [])];
  const selected = search.get('tab') === 'facilities' ? 'venues' : search.get('tab') ?? 'overview', tab = tabs.some(t => t.id === selected) ? selected : 'overview';
  const selectTab = (next: string) => {
    const params = new URLSearchParams(search);
    if (next === 'overview') params.delete('tab'); else params.set('tab', next);
    setSearch(params);
  };
  const changeTabWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(item => item.id === tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  const settings = `/organizations/${id}/workspace?tab=profile`, workspace = `/organizations/${id}/workspace`;
  const website = safeWebsite(p.website);
  const contacts = <div className="entity-contact-list">{p.addressText && <p><MapPin size={16} /><span>{p.addressText}</span></p>}{p.publicPhone && <a href={`tel:${p.publicPhone.replace(/[^+\d]/g, '')}`}><Phone size={16} />{p.publicPhone}</a>}{p.publicEmail && <a href={`mailto:${p.publicEmail}`}><Mail size={16} />{p.publicEmail}</a>}{website && <a href={website} target="_blank" rel="noopener noreferrer"><Globe size={16} />{t('website')}</a>}{!p.addressText && !p.publicPhone && !p.publicEmail && !website && <p>{t('noContact')}</p>}</div>;
  return <main className="club-page-shell entity-profile" aria-label={t('profileLabel', { name: p.displayName })}>
    <header className="entity-profile-header">
      <div className={`entity-profile-cover ${!blocked && data.branding?.bannerUrl ? 'entity-profile-cover--image' : ''}`}>{!blocked && data.branding?.bannerUrl && <MediaImage src={data.branding.bannerUrl} alt="" />}{!data.branding?.bannerUrl && <div className="entity-cover-shade" />}{editable && <Link className="entity-cover-edit" to={settings}><Camera size={15} />{t('editCover')}</Link>}</div>
      <div className="entity-profile-frame entity-identity">
        <div className="entity-logo">{!blocked && data.branding?.logoUrl ? <MediaImage src={data.branding.logoUrl} alt={t('logo', { name: p.displayName })} /> : <span aria-hidden="true">{p.displayName.substring(0, 2).toUpperCase()}</span>}{editable && <Link to={settings} aria-label={t('editLogo')}><Camera size={15} /></Link>}</div>
        <div className="entity-identity-copy"><div className="entity-title-row"><h1>{p.displayName}</h1>{p.verificationStatus === 'VERIFIED' && <span className="entity-verified"><ShieldCheck size={14} />{t('verified')}</span>}</div>
          <div className="entity-identity-meta"><span>{t(`type.${p.profileKind}`, { defaultValue: t('type.OTHER') })}</span>{!blocked && p.addressText && <span><MapPin size={13} />{p.addressText}</span>}{data.membershipRole && <span>{t(`membership.${data.membershipRole}`, { defaultValue: data.membershipRole.toLowerCase().replaceAll('_', ' ') })}</span>}{!blocked && (data.canOpenWorkspace || !p.published) && <span className="entity-publication-status">{p.published ? t('published') : t('draft')}</span>}</div>
          {!blocked && p.description && <p className="entity-description">{p.description}</p>}
        </div>
        <div className="entity-profile-actions">{editable && <Link className="entity-button" to={settings}><Settings size={15} />{t('edit')}</Link>}{data.canOpenWorkspace && <Link className="entity-button entity-button-primary" to={workspace}>{t('workspace')}</Link>}</div>
      </div>
    </header>
    <nav className="entity-profile-tabs" aria-label={t('sections')}><div className="entity-profile-frame" role="tablist" aria-label={t('sections')} onKeyDown={changeTabWithKeyboard}>{tabs.map(({ id: key, label, icon: Icon }) => <button type="button" role="tab" key={key} id={`organization-${id}-tab-${key}`} aria-controls={`organization-${id}-panel`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => selectTab(key)}><Icon size={16} aria-hidden="true" />{label}</button>)}</div></nav>
    <div className="entity-profile-frame entity-profile-body" id={`organization-${id}-panel`} role="tabpanel" aria-labelledby={`organization-${id}-tab-${tab}`} tabIndex={0}>
      {blocked ? <section className="entity-panel" role="status"><h2>{t('restricted')}</h2><p>{t('operational')}</p></section> : tab === 'overview' ? <>{data.canOpenWorkspace && <section className="entity-overview-work"><div><p className="entity-eyebrow">Your connection</p><h2>Your organization. Your next move.</h2><p>Your responsibilities and personal work stay connected.</p></div><Link className="entity-button entity-button-primary" to={workspace}>Continue in workspace</Link><ConnectedWork/></section>}<div className="entity-profile-grid entity-overview-grid">
        <aside className="entity-panel"><p className="entity-eyebrow">{t('information')}</p><h2>{t('glance')}</h2>{contacts}</aside>
        <section className="entity-panel entity-introduction"><h2>{t('about', { name: p.displayName })}</h2><p>{p.description || t('noIntroduction')}</p>{p.focus && <><hr /><h3>{focusLabel(p.profileKind, t)}</h3><p>{p.focus}</p></>}{editable && !p.description && <Link className="entity-button" to={settings}>{t('complete')}</Link>}</section>
        <aside className="entity-panel"><h2>{t('activities')}</h2><div className="entity-activity-links">{hasTournaments && <Link to={`?tab=tournaments`}><Trophy size={18} /><span>{t('tournaments')}<small>{data.competitions.length ? t('competitionCount', { count: data.competitions.length }) : t('competitionHint')}</small></span></Link>}{hasFacilities && <Link to="?tab=venues"><Building2 size={18} /><span>{t('venues')}<small>{venueCount ? t('venueCount', { count: venueCount }) : t('venueHint')}</small></span></Link>}{!hasTournaments && !hasFacilities && <p>{t(`type.${p.profileKind}`, { defaultValue: t('type.OTHER') })}{p.focus ? ` · ${focusLabel(p.profileKind, t).toLowerCase()}` : ''}</p>}<Link to="?tab=contact"><Phone size={18} /><span>{t('contactAction')}</span></Link></div></aside>
      </div></> : ['venues', 'schedule', 'prices'].includes(tab) ? <><OrganizationVenues venues={data.portfolio?.venues.length ? data.portfolio.venues : p.capabilities?.venueAvailable ? [{ id: p.id }] : []} view={tab as 'venues' | 'schedule' | 'prices'} />{data.canOpenWorkspace && <div className="entity-profile-actions"><Link className="entity-button" to={`${workspace}?tab=facilities`}>{t('manageVenues')}</Link></div>}</> : tab === 'tournaments' ? <section className="entity-section"><h2>{t('tournaments')}</h2>{data.competitions.length ? <div className="entity-competition-grid">{data.competitions.map(c => <Link className="entity-panel entity-competition" key={c.id} to={`/tournaments/${c.id}`}><Trophy size={24} /><h3>{c.name}</h3><p>{c.status.replaceAll('_', ' ').toLowerCase()}</p><span>{t('viewTournament')}</span></Link>)}</div> : <p>{t('noTournaments')}</p>}{p.canCreateTournament && <Link className="entity-button" to={`/tournaments/setup?organizer=${id}`}>{t('createTournament')}</Link>}</section> : <section className="entity-panel entity-detail"><h2>{tab === 'contact' ? t('contact') : focusLabel(p.profileKind, t)}</h2>{tab === 'contact' ? contacts : <p>{p.focus}</p>}</section>}
    </div>
  </main>;
}

/** Workspace editing never embeds a second public profile. */
export function OrganizationProfileEditor({ id, onSaved }: { id: string; onSaved?: () => void }) {
  const { t } = useTranslation('translation', { keyPrefix: 'experience.organization' });
  const [profile, setProfile] = useState<OrganizationProfile | null>(null), [draft, setDraft] = useState<OrganizationProfileDraft | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const active = useRef(true), saving = useRef(false);
  useEffect(() => {
    active.current = true; const controller = new AbortController();
    void apiClient.get<OrganizationProfile>(`/organizations/${id}`, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) { setProfile(r.data); setDraft(draftFrom(r.data)); } }).catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, '') || 'detailsError'); });
    return () => { active.current = false; controller.abort(); };
  }, [id, attempt]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft || !profile?.canEdit || profile.promotionBlocked || saving.current) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try { const r = await apiClient.put<OrganizationProfile>(`/organizations/${id}`, draft); if (active.current) { setProfile(r.data); setDraft(draftFrom(r.data)); setMessage(t('saved')); onSaved?.(); } }
    catch (e) { if (active.current) setError(extractApiErrorMessage(e, t('saveError'))); }
    finally { saving.current = false; if (active.current) setBusy(false); }
  }
  if (profile?.clubId) return <Navigate replace to={`/clubs/${profile.clubId}/profile-settings`} />;
  return <section className="org-setup-card"><h2>{t('details')}</h2>{error && <p role="alert">{error === 'detailsError' ? t('detailsError') : error} <button type="button" onClick={() => { setError(''); setAttempt(n => n + 1); }}>{t('reload')}</button></p>}{!profile && !error && <p role="status">{t('detailsLoading')}</p>}{profile && !profile.canEdit && <p>{t('editPermission')}</p>}{profile?.promotionBlocked && <p>{t('editRestricted')}</p>}{profile?.canEdit && !profile.promotionBlocked && draft && <><form onSubmit={save} className="org-profile-form"><fieldset disabled={busy}><legend>{t('editLegend')}</legend>
    <label className="org-profile-check org-profile-span"><input type="checkbox" checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })} />{t('publish')}</label>
    <label>{t('name')}<input required maxLength={255} value={draft.displayName} onChange={e => setDraft({ ...draft, displayName: e.target.value })} /></label><label>{t('address')}<input maxLength={500} value={draft.addressText ?? ''} onChange={e => setDraft({ ...draft, addressText: e.target.value })} /></label>
    <label className="org-profile-span">{t('aboutField')}<textarea rows={4} maxLength={4000} value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label><label className="org-profile-span">{focusLabel(profile.profileKind, t)}<textarea rows={4} maxLength={2000} value={draft.focus ?? ''} onChange={e => setDraft({ ...draft, focus: e.target.value })} /></label>
    <label>{t('websiteField')}<input type="url" maxLength={500} value={draft.website ?? ''} onChange={e => setDraft({ ...draft, website: e.target.value })} /></label><label>{t('email')}<input type="email" maxLength={254} value={draft.publicEmail ?? ''} onChange={e => setDraft({ ...draft, publicEmail: e.target.value })} /></label><label>{t('phone')}<input type="tel" maxLength={60} value={draft.publicPhone ?? ''} onChange={e => setDraft({ ...draft, publicPhone: e.target.value })} /></label>
    <div className="org-profile-form-actions"><button className="org-profile-save" disabled={busy || !draft.displayName.trim()}>{busy ? t('saving') : t('save')}</button></div></fieldset></form>{message && <p role="status">{message}</p>}<OrganizationBranding id={Number(id)} editable /></>}</section>;
}
