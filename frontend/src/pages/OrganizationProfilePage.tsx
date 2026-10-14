import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, Camera, Mail, MapPin, Phone, Settings, ShieldCheck, Trophy, Globe } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, ButtonLink, EmptyNote, GkRoot, List, ListRow, PageFrame, Panel, Section, Skeleton } from '../design/primitives';
import { ProfileLayout, SideBlock } from '../design/profile/ProfileLayout';
import type { TabItem } from '../design/Tabs';
import { extractApiErrorMessage } from '../utils/apiError';
import type { OrganizationProfile, OrganizationProfileDraft } from '../features/organizations/domain';
import { OrganizationVenues } from '../features/organizations/presentation/OrganizationVenues';
import { OrganizationBranding } from '../features/organizations/setup/OrganizationBranding';
import { PageEditProvider } from '../features/pages/edit/PageEditProvider';
import { usePageEdit } from '../features/pages/edit/context';
import { OrganizationPage } from '../features/pages/OrganizationPage';
import '../features/organizations/presentation/organization-profile.css';

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
  // A fan club, a business or any other page lives on the shared page DNA; older organisations keep their presentation.
  return <PageEditProvider key={`${organizationId}:${sessionId}`} pageRef={{ type: 'organization', id: Number(organizationId) }}><OrganizationPageOrLegacy id={organizationId} /></PageEditProvider>;
}
function OrganizationPageOrLegacy({ id }: { id: string }) {
  const { page, loading, notFound } = usePageEdit();
  if (notFound) return <OrganizationProfileContent id={id} />;
  if (!page && loading) return <GkRoot className="gk-page gk-profile"><PageFrame width="profile"><div role="status" aria-label="Loading" className="gk-stack gk-stack--tight gk-org-state"><Skeleton height={104} width={104} /><Skeleton height={28} width="40%" /><Skeleton height={160} /></div></PageFrame></GkRoot>;
  return <OrganizationPage />;
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
  if (!data) return <GkRoot className="gk-page gk-profile"><PageFrame width="profile"><div className="gk-org-state">
    {error ? <Panel><EmptyNote title={<span role="alert">{error === 'loadError' ? t('loadError') : error}</span>} action={<Button onClick={() => { setError(''); setAttempt(n => n + 1); }}>{t('retry')}</Button>} /></Panel>
      : <div role="status" aria-label={t('loading')} className="gk-stack gk-stack--tight"><Skeleton height={104} width={104} /><Skeleton height={28} width="40%" /><Skeleton height={160} /></div>}
    <ButtonLink variant="ghost" to="/my-organizations">{t('myOrganizations')}</ButtonLink>
  </div></PageFrame></GkRoot>;
  const p = data.profile;
  if (p.clubId) return <Navigate replace to={`/clubs/${p.clubId}${search.has('tab') ? `?tab=${encodeURIComponent(search.get('tab') ?? '')}` : ''}`} />;
  const blocked = p.promotionBlocked === true, editable = p.canEdit && !blocked;
  const venueCount = new Set(data.portfolio?.venues.map(v => v.id)).size;
  const hasFacilities = !blocked && (venueCount > 0 || p.capabilities?.venueAvailable === true);
  const hasTournaments = !blocked && (data.competitions.length > 0 || p.capabilities?.enabledActivities.includes('TOURNAMENT'));
  const tabs: TabItem<string>[] = [{ id: 'overview', label: t('overview') }, ...(!blocked && p.focus ? [{ id: 'focus', label: focusLabel(p.profileKind, t) }] : []),
    ...(hasFacilities ? [{ id: 'venues', label: t('venues') }, { id: 'schedule', label: t('schedule') }, { id: 'prices', label: t('prices') }] : []),
    ...(hasTournaments ? [{ id: 'tournaments', label: t('tournaments') }] : []), ...(!blocked ? [{ id: 'contact', label: t('contact') }] : [])];
  const selected = search.get('tab') === 'facilities' ? 'venues' : search.get('tab') ?? 'overview', tab = tabs.some(item => item.id === selected) ? selected : 'overview';
  const selectTab = (next: string) => {
    const params = new URLSearchParams(search);
    if (next === 'overview') params.delete('tab'); else params.set('tab', next);
    setSearch(params);
  };
  const settings = `/organizations/${id}/workspace?tab=profile`, workspace = `/organizations/${id}/workspace`;
  const website = safeWebsite(p.website);
  const kind = t(`type.${p.profileKind}`, { defaultValue: t('type.OTHER') });
  const role = data.membershipRole ? t(`membership.${data.membershipRole}`, { defaultValue: data.membershipRole.toLowerCase().replaceAll('_', ' ') }) : null;
  const contacts = <List label={t('contact')}>
    {p.addressText && <ListRow lead={<MapPin size={18} aria-hidden="true" />} title={p.addressText} />}
    {p.publicPhone && <li><a className="gk-list-row" href={`tel:${p.publicPhone.replace(/[^+\d]/g, '')}`}><Phone size={18} aria-hidden="true" /><span className="gk-list-row__main"><span className="gk-list-row__title">{p.publicPhone}</span></span></a></li>}
    {p.publicEmail && <li><a className="gk-list-row" href={`mailto:${p.publicEmail}`}><Mail size={18} aria-hidden="true" /><span className="gk-list-row__main"><span className="gk-list-row__title">{p.publicEmail}</span></span></a></li>}
    {website && <li><a className="gk-list-row" href={website} target="_blank" rel="noopener noreferrer"><Globe size={18} aria-hidden="true" /><span className="gk-list-row__main"><span className="gk-list-row__title">{t('website')}</span></span></a></li>}
    {!p.addressText && !p.publicPhone && !p.publicEmail && !website && <ListRow title={t('noContact')} />}
  </List>;
  const side = blocked ? undefined : <>
    <SideBlock title={t('glance')}>{contacts}</SideBlock>
    <SideBlock title={t('activities')}><List label={t('activities')}>
      {hasTournaments && <ListRow to="?tab=tournaments" lead={<Trophy size={18} aria-hidden="true" />} title={t('tournaments')} meta={data.competitions.length ? t('competitionCount', { count: data.competitions.length }) : t('competitionHint')} />}
      {hasFacilities && <ListRow to="?tab=venues" lead={<Building2 size={18} aria-hidden="true" />} title={t('venues')} meta={venueCount ? t('venueCount', { count: venueCount }) : t('venueHint')} />}
      <ListRow to="?tab=contact" lead={<Phone size={18} aria-hidden="true" />} title={t('contactAction')} />
    </List></SideBlock>
  </>;
  return <ProfileLayout
    identity={{ name: p.displayName, image: blocked ? null : data.branding?.logoUrl, square: true,
      badge: p.verificationStatus === 'VERIFIED' ? <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />{t('verified')}</Badge> : undefined,
      line: [kind, role].filter(Boolean).join(' · '),
      facts: [!blocked && p.addressText ? <><MapPin aria-hidden="true" />{p.addressText}</> : null,
        !blocked && (data.canOpenWorkspace || !p.published) ? <Badge tone={p.published ? 'accent' : 'warning'}>{p.published ? t('published') : t('draft')}</Badge> : null] }}
    banner={blocked ? null : data.branding?.bannerUrl}
    bannerAction={editable ? <ButtonLink size="sm" to={settings}><Camera aria-hidden="true" />{t('editCover')}</ButtonLink> : undefined}
    imageAction={editable ? <ButtonLink size="sm" iconOnly to={settings} aria-label={t('editLogo')}><Camera aria-hidden="true" /></ButtonLink> : undefined}
    actions={<>{editable && <ButtonLink to={settings}><Settings aria-hidden="true" />{t('edit')}</ButtonLink>}{data.canOpenWorkspace && <ButtonLink variant="primary" to={workspace}>{t('workspace')}</ButtonLink>}</>}
    tabs={tabs} tab={tab} onTab={selectTab} tabsLabel={t('sections')} side={tab === 'contact' ? undefined : side} sideLabel={t('information')}>
    {blocked ? <div className="gk-notice gk-notice--warning" role="status"><span><strong>{t('restricted')}</strong> {t('operational')}</span></div>
      : tab === 'overview' ? <Section title={t('about', { name: p.displayName })}>
          <p className="gk-org-about">{p.description || t('noIntroduction')}</p>
          {p.focus && <><h3 className="gk-org-focus">{focusLabel(p.profileKind, t)}</h3><p className="gk-org-about">{p.focus}</p></>}
          {editable && !p.description && <ButtonLink size="sm" to={settings}>{t('complete')}</ButtonLink>}
        </Section>
      : ['venues', 'schedule', 'prices'].includes(tab) ? <>
        <OrganizationVenues venues={data.portfolio?.venues.length ? data.portfolio.venues : p.capabilities?.venueAvailable ? [{ id: p.id }] : []} view={tab as 'venues' | 'schedule' | 'prices'} />
        {data.canOpenWorkspace && <ButtonLink className="gk-org-manage" to={`${workspace}?tab=facilities`}>{t('manageVenues')}</ButtonLink>}
      </>
      : tab === 'tournaments' ? <Section title={t('tournaments')} action={p.canCreateTournament ? <ButtonLink size="sm" variant="primary" to={`/world/tournaments?peek=draw-o${id}`}>{t('createTournament')}</ButtonLink> : undefined}>
        <Panel flush>{data.competitions.length ? <List label={t('tournaments')}>{data.competitions.map(c => <ListRow key={c.id} to={`/tournaments/${c.id}`}
          lead={<Trophy size={18} aria-hidden="true" />} title={c.name} meta={c.status.replaceAll('_', ' ').toLowerCase().replace(/^./, letter => letter.toUpperCase())} />)}</List>
          : <EmptyNote title={t('noTournaments')} />}</Panel>
      </Section>
      : <Section title={tab === 'contact' ? t('contact') : focusLabel(p.profileKind, t)}>
        {tab === 'contact' ? <Panel flush>{contacts}</Panel> : <p className="gk-org-about">{p.focus}</p>}
      </Section>}
  </ProfileLayout>;
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
