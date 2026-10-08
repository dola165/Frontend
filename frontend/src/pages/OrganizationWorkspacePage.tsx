import { EmptyState } from '../components/ui/EmptyState';
import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';
import { OrganizationProfileEditor } from './OrganizationProfilePage';
import { OrganizationPortfolio } from '../features/organizations/OrganizationPortfolio';
import { OrganizationActivitySettings } from '../features/organizations/activities/OrganizationActivitySettings';
import { OrganizationDelegationPanel } from '../features/organizations/activities/OrganizationDelegationPanel';
import type { OrganizationCapabilities } from '../features/organizations/activities/api';
import { organizationTypes, typeLabel } from '../features/organizations/setup/domain';
import { WorkspaceImports } from '../features/organizations/setup/WorkspaceImports';
import { OrganizationTeam } from '../features/organizations/setup/OrganizationTeam';
import { OrganizationLifecycle } from '../features/organizations/setup/OrganizationLifecycle';
import '../features/organizations/setup/setup.css';
interface Workspace { id: number; displayName: string; organizationType: string; identityRevision: number; clubId: number | null; membershipRole: string; canManage: boolean; promotionBlocked: boolean; capabilities: OrganizationCapabilities; team: { userId: number; name: string; role: string }[]; venueCount: number; tournaments: { id: number; name: string; status: string; canManage: boolean }[] }
export function OrganizationWorkspacePage() {
  const { t } = useTranslation();
  const { organizationId } = useParams(), { sessionId } = useAuth();
  if (!organizationId || !/^\d+$/.test(organizationId) || !Number.isSafeInteger(Number(organizationId)) || Number(organizationId) <= 0) return <p role="alert">{t('experience.organization.notFound')}</p>;
  return <WorkspaceContent key={`${organizationId}:${sessionId}`} id={organizationId} />;
}
function WorkspaceContent({ id }: { id: string }) {
  const { t } = useTranslation();
  const { refreshNavigationCapabilities } = useAuth();
  const [search, setSearch] = useSearchParams();
  const [workspace, setWorkspace] = useState<Workspace | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [type, setType] = useState(''), [busy, setBusy] = useState(false);
  const active = useRef(true), submitting = useRef(false);
  useEffect(() => { active.current = true; const controller = new AbortController(); setError(''); void apiClient.get<Workspace>(`/organizations/${id}/workspace`, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) { setWorkspace(r.data); setType(r.data.organizationType); } }).catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, '') || 'loadError'); }); return () => { controller.abort(); active.current = false; }; }, [id, attempt]);
  async function saveType(event: FormEvent) {
    event.preventDefault(); if (!workspace || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { const response = await apiClient.put<Workspace>(`/organizations/${id}/identity`, { revision: workspace.identityRevision, organizationType: type }); if (active.current) setWorkspace(response.data); }
    catch (err) { if (active.current) setError(extractApiErrorMessage(err, t('experience.workspace.saveError'))); }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  }
  if (!workspace) return <main className="org-setup"><Link to="/my-organizations">← {t('experience.workspace.back')}</Link>{error ? <><p role="alert">{error === 'loadError' ? t('experience.workspace.error') : error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{t('experience.workspace.retry')}</button></> : <p role="status">{t('experience.workspace.loading')}</p>}</main>;
  if (workspace.clubId) {
    const requested = search.get('tab');
    if (requested === 'profile') return <Navigate replace to={`/clubs/${workspace.clubId}/profile-settings`} />;
    const tab = requested === 'team' ? 'personnel' : ['settings', 'imports', 'facilities'].includes(requested ?? '') ? 'settings' : 'overview';
    const section = requested === 'imports' ? '&section=imports' : requested === 'facilities' ? '&section=facilities' : '';
    return <Navigate replace to={`/clubs/${workspace.clubId}/workspace${tab === 'overview' ? '' : `?tab=${tab}${section}`}`} />;
  }
  const caps = workspace.capabilities;
  const hasFacilities = caps.venueAvailable || workspace.venueCount > 0;
  const tabs = ['overview', 'profile', ...(hasFacilities ? ['facilities'] : []), ...(caps.enabledActivities.includes('TOURNAMENT') || workspace.tournaments.length ? ['tournaments'] : []), 'team', ...(workspace.canManage ? ['imports', 'settings'] : [])];
  const selected = search.get('tab') ?? 'overview', tab = tabs.includes(selected) ? selected : 'overview';
  const selectTab = (next: string) => {
    const params = new URLSearchParams(search);
    if (next === 'overview') params.delete('tab'); else params.set('tab', next);
    setSearch(params);
  };
  const navigateSections = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next]); event.currentTarget.querySelectorAll('button')[next]?.focus();
  };
  const backPath = caps.venueAvailable ? '/my-organizations?kind=VENUE' : '/my-organizations';
  return <main className="org-setup"><Link to={backPath}>← {t(caps.venueAvailable ? 'experience.workspace.backVenues' : 'experience.workspace.back')}</Link><header className="org-setup-header"><div><p className="org-setup-kicker">{t('experience.workspace.title', { type: t(`experience.organization.type.${workspace.organizationType}`, { defaultValue: typeLabel(workspace.organizationType) }) })}</p><h1>{workspace.displayName}</h1><p>{t('experience.workspace.responsibility', { role: t(`experience.organization.membership.${workspace.membershipRole}`, { defaultValue: workspace.membershipRole.toLowerCase() }) })}</p></div><div className="org-setup-actions"><Link className="org-setup-button" to={`/organizations/${id}`}>{t('experience.workspace.profile')}</Link></div></header>
    <nav className="org-setup-nav" aria-label={t('experience.workspace.sections')} onKeyDown={navigateSections}>{tabs.map(key => <button type="button" key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => selectTab(key)}>{t(`experience.workspace.${key === 'profile' ? 'profileTab' : key}`)}</button>)}</nav>
    {error && <p role="alert">{error === 'loadError' ? t('experience.workspace.error') : error}</p>}
    {workspace.promotionBlocked && <p className="org-setup-notice">{t('experience.workspace.restricted')}</p>}
    {tab === 'overview' && <><section className="org-setup-card"><h2>{t('experience.workspace.work')}</h2><p>{t('experience.workspace.workHint')}</p><div className="org-setup-modules">
      <button type="button" className="org-setup-module" onClick={() => selectTab('profile')}><strong>{t('experience.workspace.profileTab')}</strong><span>{t('experience.workspace.profileHint')}</span></button>
      {caps.canCreateTournament && <Link className="org-setup-module" to={`/tournaments/setup?organizer=${id}`}><strong>{t('experience.workspace.createTournament')}</strong><span>{t('experience.workspace.tournamentHint')}</span></Link>}
      {caps.canManageVenueBookings && <Link className="org-setup-module" to={`/stadiums/${id}/manage`}><strong>{t('experience.workspace.venueOperations')}</strong><span>{t('experience.workspace.venueHint')}</span></Link>}
      {workspace.canManage && <button type="button" className="org-setup-module" onClick={() => selectTab('imports')}><strong>{t('experience.workspace.importData')}</strong><span>{t('experience.workspace.importHint')}</span></button>}
      {workspace.canManage && <button type="button" className="org-setup-module" onClick={() => selectTab('settings')}><strong>{t('experience.workspace.activitiesSettings')}</strong><span>{t('experience.workspace.settingsHint')}</span></button>}
    </div></section>{hasFacilities && <OrganizationPortfolio id={workspace.id} />}</>}
    {tab === 'tournaments' && <section className="org-setup-card"><h2>{t('experience.workspace.tournaments')}</h2>{caps.canCreateTournament && <Link className="org-setup-button org-setup-primary" to={`/tournaments/setup?organizer=${id}`}>{t('experience.workspace.createTournament')}</Link>}{!workspace.tournaments.length && <EmptyState icon={Trophy} title={t('experience.workspace.noTournaments')} description={t('experience.workspace.tournamentHint')}/>}<div className="org-setup-modules">{workspace.tournaments.map(tournament => <Link key={tournament.id} className="org-setup-module" to={`/tournaments/${tournament.id}${tournament.canManage ? '/workspace' : ''}`}><strong>{tournament.name}</strong><span>{tournament.status} · {tournament.canManage ? t('experience.workspace.open') : t('experience.workspace.viewTournament')}</span></Link>)}</div></section>}
    {tab === 'profile' && <OrganizationProfileEditor id={id} onSaved={() => setAttempt(n => n + 1)} />}
    {tab === 'facilities' && <><section className="org-setup-card"><h2>{t('experience.workspace.facilities')}</h2><p>{t('experience.workspace.facilitiesHint')}</p>{caps.canManageVenueBookings && <Link className="org-setup-button" to={`/stadiums/${id}/manage`}>{t('experience.workspace.manageVenue')}</Link>}{workspace.canManage && <div className="org-setup-actions"><button type="button" onClick={() => selectTab('imports')}>{t('experience.workspace.importVenues')}</button><Link className="org-setup-button" to="/organizations/create?kind=VENUE">{t('experience.workspace.createVenue')}</Link></div>}</section><OrganizationPortfolio id={workspace.id} /></>}
    {tab === 'team' && <><OrganizationLifecycle id={workspace.id} onChanged={() => setAttempt(n => n + 1)} />{workspace.canManage && <OrganizationTeam id={workspace.id} />}{caps.canInviteVenueOperator && <OrganizationDelegationPanel id={workspace.id} />}</>}
    {tab === 'imports' && <WorkspaceImports key={`${id}:${tab}`} id={workspace.id} clubId={workspace.clubId} blocked={workspace.promotionBlocked} />}
    {tab === 'settings' && <><section className="org-setup-card"><h2>{t('experience.workspace.activities')}</h2><OrganizationActivitySettings id={workspace.id} onChanged={value => { setWorkspace({ ...workspace, capabilities: value }); void refreshNavigationCapabilities().catch(() => undefined); }} /></section>
      <details className="org-setup-card"><summary>{t('experience.workspace.connect')}</summary><OrganizationPortfolio id={workspace.id} /></details>
      <section className="org-setup-card"><h2>{t('experience.workspace.type')}</h2><p>{t('experience.workspace.typeHint')}</p><form onSubmit={saveType}><fieldset disabled={busy}><label>{t('experience.workspace.typeLabel')}<select value={type} onChange={e => setType(e.target.value)}>{organizationTypes.filter(([key]) => key !== 'CLUB').map(([key, label]) => <option key={key} value={key}>{t(`experience.organization.type.${key}`, { defaultValue: label })}</option>)}</select></label><button className="org-setup-primary" disabled={type === workspace.organizationType}>{t('experience.workspace.saveType')}</button></fieldset></form></section>
    </>}
  </main>;
}
