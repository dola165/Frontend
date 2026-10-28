import { CreateLink } from '../features/pages/create/CreateLink';
import { usePagesCopy } from '../features/pages/copy';
import { useEffect, useState } from 'react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';
import { isCurrentAuthSession } from '../utils/authStorage';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { workspaceLinks } from '../context/navigationCapabilities';
import '../features/venues/venues.css';
import '../features/venues/venue-owner.css';
import { OrganizationTeamInvitations } from '../features/organizations/setup/OrganizationTeam';
import '../features/organizations/setup/setup.css';
import { VenueOwnerCard } from '../features/venues/VenueOwnerCard';
import { typeLabel } from '../features/organizations/setup/domain';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import { connectedWorkspaces } from '../components/layout/connectedWorkspaces';
import { workspaceDestinations } from '../components/layout/header/pins/pinCatalog';
import { PinGlyph } from '../components/layout/header/pins/PinsPanel';
import '../features/organizations/presentation/entity-profile.css';
import '../features/organizations/presentation/organization-venues.css';

type OrganizationWorkspace = { id:number;displayName:string;clubId:number|null;venueCount:number;organizationType?:string;kinds?:string[];status?:'DRAFT'|'LIVE';canOpenWorkspace?:boolean };

export function MyOrganizationsPage() {
  const { user, sessionId, status } = useAuth();
  const { t } = useTranslation();
  const pc = usePagesCopy();
  const copy = useJourneyCopy();
  const [search] = useSearchParams();
  const venuesOnly = search.get('kind') === 'VENUE';
  const current = status === 'authenticated' && user?.id != null && isCurrentAuthSession(sessionId);
  const capabilities = current ? user?.navigationCapabilities : undefined;
  const [attempt,setAttempt]=useState(0);
  const key=`${sessionId}:${user?.id}:${status}:${attempt}`;
  // Keep server text verbatim; an empty failure message uses the current locale's fallback at render time.
  const [result,setResult]=useState<{key:string;organizations:OrganizationWorkspace[] | null;error:string|null} | null>(null);
  const organizations=current && result?.key===key ? result.organizations : null;
  const error=current && result?.key===key ? result.error : null;
  useEffect(()=>{
    if (!current) return;
    const controller=new AbortController();
    const active = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
    void apiClient.get<OrganizationWorkspace[]>('/organizations/workspaces',{signal:controller.signal})
      .then(r=>{if(active())setResult({key,organizations:r.data,error:null});})
      .catch(e=>{if(active())setResult({key,organizations:null,error:extractApiErrorMessage(e,'')});});
    return ()=>controller.abort();
  },[current,key,sessionId]);
  const links = workspaceLinks(capabilities);
  const venues = capabilities?.workspaces.filter(w => w.id === 'venue.workspace') ?? [];
  const venueEntry = venuesOnly;
  // Every other workspace (squads, tournaments, other clubs, the person's own hubs) once the cards are known, so the
  // account menu's one "Your workspaces" line reaches everything it used to list.
  const listed = new Set([
    ...(organizations ?? []).flatMap(o => o.clubId ? [`/clubs/${o.clubId}`, `/clubs/${o.clubId}/office`] : [`/organizations/${o.id}`, `/organizations/${o.id}/workspace`]),
    ...(venues.length ? connectedWorkspaces(capabilities).filter(item => item.group === 'Venues').map(item => item.path) : []),
  ]);
  const others = !venuesOnly && (organizations || error !== null) ? workspaceDestinations(capabilities, null, copy).filter(place => !listed.has(place.path)) : [];
  return <main className="venue-page">
    <header className="venue-workspace-heading">
      <div><h1>{venuesOnly ? t('nav.myVenues', 'My venues') : t('nav.myOrganizations', 'My organizations')}</h1>
        <p>{pc(venueEntry ? 'Open a venue workspace to manage its page, pitches, calendar and booking requests.' : 'Your clubs and other organizations, with their activities, venues and team.')}</p></div>
      {!venueEntry && <CreateLink from="organizations" className="venue-button">{pc('Create a page')}</CreateLink>}
    </header>
    {!venuesOnly && venues.length > 0 && <Link className="venue-link" to="/my-organizations?kind=VENUE">{pc('My venue workspaces')}</Link>}
    {error !== null && <p role="alert">{error || pc('Could not load your organizations.')} <button type="button" onClick={()=>setAttempt(v=>v+1)}>{pc('Retry')}</button></p>}
    {!venuesOnly && !organizations && error === null && <p role="status">{pc('Loading organizations…')}</p>}
    {(venuesOnly ? !venues.length : organizations?.length === 0) && <p role="status">{pc(venuesOnly ? 'You don’t currently have a venue workspace. Create a venue organization to add pitches and start managing bookings.' : 'You don’t currently have an organization workspace. Your workspaces will appear here when you have access.')}</p>}
    {venuesOnly && organizations?.filter(o => !o.clubId && !o.kinds?.includes('VENUE') && o.venueCount > 0).map(o => <section className="venue-organization-entry" key={o.id} aria-label={o.displayName}><div><p>{pc('Your organization')}</p><h2>{o.displayName}</h2></div><div className="organization-card-links"><Link className="venue-button venue-button--primary" to={`/organizations/${o.id}?tab=venues`}>{pc('View organization profile')}</Link><Link className="venue-button" to={`/organizations/${o.id}/workspace`}>{pc('Open workspace')}</Link></div></section>)}
    {venuesOnly && <Link className="venue-link" to="/my-organizations">{pc('All my organizations')}</Link>}
    {!venuesOnly && current && <OrganizationTeamInvitations key={sessionId} onAccepted={()=>setAttempt(v=>v+1)} />}
    <div className="venue-owner-portfolio">
      {(venuesOnly ? venues : (organizations ?? []).map(o=>({id:'organization.workspace',context:{id:o.id,label:o.displayName}}))).map(workspace => {
        const id = workspace.context.id;
        const organization=organizations?.find(o=>o.id===id);
        const venue = workspace.id === 'venue.workspace';
        const settings = links.find(link => link.capability === 'organization.settings' && link.path === `/organizations/${id}/workspace?tab=settings`);
        if (venue) return <VenueOwnerCard key={`${sessionId}/${id}`} id={id} label={workspace.context.label} settings={settings?.path}/>;
        return <article key={id} className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <Building2 className="mb-4 h-7 w-7 text-[var(--venue-accent)]" />
          <p className="venue-eyebrow">{pc(organization?.clubId ? 'Club' : typeLabel(organization?.organizationType ?? 'OTHER'))}</p>
          <h2 className="break-words">{workspace.context.label}</h2>
          {organization?.status && <p className="venue-tag">{pc(organization.status === 'DRAFT' ? 'Draft' : 'Live')}</p>}
          <p className="mt-3 text-[var(--text-secondary)]">{(organization?.venueCount ?? 0) > 0 ? `${pc('{count} venues listed', { count: organization?.venueCount ?? 0 })} · ` : ''}{pc('Profile, activities and team.')}</p>
          <div className="organization-card-links">
            <Link className="venue-button venue-button--primary" to={organization?.clubId ? `/clubs/${organization.clubId}` : `/organizations/${id}`}>{pc('View profile')}</Link>
            {organization?.canOpenWorkspace !== false && <Link className="venue-button" to={organization?.clubId ? `/clubs/${organization.clubId}/office` : `/organizations/${id}/workspace`}><Settings2 size={16}/>{organization?.clubId ? copy('Club office', 'კლუბის ოფისი') : pc('Open workspace')}</Link>}
          </div>
        </article>;
      })}
    </div>
    {others.length > 0 && <section className="organization-other-work" aria-labelledby="organization-other-work">
      <h2 id="organization-other-work">{copy('Squads, tournaments and other work', 'გუნდები, ტურნირები და სხვა საქმე')}</h2>
      <ul>{others.map(place => <li key={place.path}><Link to={place.path}><PinGlyph icon={place.icon} /><span><strong>{place.label}</strong><small>{place.kind}</small></span></Link></li>)}</ul>
    </section>}
  </main>;
}
