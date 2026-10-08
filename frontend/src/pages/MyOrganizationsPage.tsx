import { useEffect, useState } from 'react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { hasNavigationCapability, workspaceLinks } from '../context/navigationCapabilities';
import '../features/venues/venues.css';
import '../features/venues/venue-owner.css';
import { OrganizationTeamInvitations } from '../features/organizations/setup/OrganizationTeam';
import '../features/organizations/setup/setup.css';
import { VenueOwnerCard } from '../features/venues/VenueOwnerCard';
import { typeLabel } from '../features/organizations/setup/domain';
import '../features/organizations/presentation/entity-profile.css';
import '../features/organizations/presentation/organization-venues.css';

export function MyOrganizationsPage() {
  const { user, sessionId } = useAuth();
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const venuesOnly = search.get('kind') === 'VENUE';
  const capabilities = user?.navigationCapabilities;
  const [attempt,setAttempt]=useState(0);
  const key=`${sessionId}:${attempt}`;
  const [result,setResult]=useState<{key:string;organizations:{id:number;displayName:string;clubId:number|null;venueCount:number;organizationType?:string;kinds?:string[]}[] | null;error:string} | null>(null);
  const organizations=result?.key===key ? result.organizations : null;
  const error=result?.key===key ? result.error : '';
  useEffect(()=>{
    const controller=new AbortController();
    void apiClient.get('/organizations/workspaces',{signal:controller.signal})
      .then(r=>{if(!controller.signal.aborted)setResult({key,organizations:r.data,error:''});})
      .catch(e=>{if(!controller.signal.aborted)setResult({key,organizations:null,error:extractApiErrorMessage(e,'Could not load your organizations.')});});
    return ()=>controller.abort();
  },[key]);
  const links = workspaceLinks(capabilities);
  const venues = capabilities?.workspaces.filter(w => w.id === 'venue.workspace') ?? [];
  const venueEntry = venuesOnly;
  return <main className="venue-page">
    <header className="venue-workspace-heading">
      <div><h1>{venuesOnly ? t('nav.myVenues', 'My venues') : t('nav.myOrganizations', 'My organizations')}</h1>
        <p>{venueEntry ? 'Open a venue workspace to manage its page, pitches, calendar and booking requests.' : 'Your clubs and other organizations, with their activities, venues and team.'}</p></div>
      {hasNavigationCapability(capabilities, 'organization.create') && <Link className="venue-button" to={venueEntry ? '/organizations/create?kind=VENUE' : '/organizations/create'}>{venueEntry ? 'Add venue' : 'Add organization'}</Link>}
    </header>
    {!venuesOnly && venues.length > 0 && <Link className="venue-link" to="/my-organizations?kind=VENUE">My venue workspaces</Link>}
    {error && <p role="alert">{error} <button type="button" onClick={()=>setAttempt(v=>v+1)}>Retry</button></p>}
    {!venuesOnly && !organizations && !error && <p role="status">Loading organizations…</p>}
    {(venuesOnly ? !venues.length : organizations?.length === 0) && <p role="status">{venuesOnly ? 'You don’t currently have a venue workspace. Create a venue organization to add pitches and start managing bookings.' : 'You don’t currently have an organization workspace. Your workspaces will appear here when you have access.'}</p>}
    {venuesOnly && organizations?.filter(o => !o.clubId && !o.kinds?.includes('VENUE') && o.venueCount > 0).map(o => <section className="venue-organization-entry" key={o.id} aria-label={o.displayName}><div><p>Your organization</p><h2>{o.displayName}</h2></div><div className="organization-card-links"><Link className="venue-button venue-button--primary" to={`/organizations/${o.id}?tab=venues`}>View organization profile</Link><Link className="venue-button" to={`/organizations/${o.id}/workspace`}>Open workspace</Link></div></section>)}
    {venuesOnly && <Link className="venue-link" to="/my-organizations">All my organizations</Link>}
    {!venuesOnly && <OrganizationTeamInvitations key={sessionId} onAccepted={()=>setAttempt(v=>v+1)} />}
    <div className="venue-owner-portfolio">
      {(venuesOnly ? venues : (organizations ?? []).map(o=>({id:'organization.workspace',context:{id:o.id,label:o.displayName}}))).map(workspace => {
        const id = workspace.context.id;
        const organization=organizations?.find(o=>o.id===id);
        const venue = workspace.id === 'venue.workspace';
        const settings = links.find(link => link.capability === 'organization.settings' && link.path === `/organizations/${id}/workspace?tab=settings`);
        if (venue) return <VenueOwnerCard key={`${sessionId}/${id}`} id={id} label={workspace.context.label} settings={settings?.path}/>;
        return <article key={id} className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <Building2 className="mb-4 h-7 w-7 text-[var(--venue-accent)]" />
          <p className="venue-eyebrow">{organization?.clubId ? 'Club' : typeLabel(organization?.organizationType ?? 'OTHER')}</p>
          <h2 className="break-words">{workspace.context.label}</h2>
          <p className="mt-3 text-[var(--text-secondary)]">{(organization?.venueCount ?? 0) > 0 ? `${organization?.venueCount} venues listed · ` : ''}Profile, activities and team.</p>
          <div className="organization-card-links">
            <Link className="venue-button venue-button--primary" to={organization?.clubId ? `/clubs/${organization.clubId}` : `/organizations/${id}`}>View profile</Link>
            <Link className="venue-button" to={organization?.clubId ? `/clubs/${organization.clubId}/workspace` : `/organizations/${id}/workspace`}><Settings2 size={16}/>Open workspace</Link>
          </div>
        </article>;
      })}
    </div>
  </main>;
}
