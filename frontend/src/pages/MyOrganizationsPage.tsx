import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { hasNavigationCapability, workspaceLinks } from '../context/navigationCapabilities';
import { organizationNavigation } from '../components/layout/organizationNavigation';
import '../features/venues/venues.css';
import '../features/venues/venue-owner.css';
import { VenueOwnerCard } from '../features/venues/VenueOwnerCard';

export function MyOrganizationsPage() {
  const { user, sessionId } = useAuth();
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const venuesOnly = search.get('kind') === 'VENUE';
  const capabilities = user?.navigationCapabilities;
  const navigation = organizationNavigation(capabilities);
  const links = workspaceLinks(capabilities);
  const venues = capabilities?.workspaces.filter(w => w.id === 'venue.workspace') ?? [];
  const organizations = venuesOnly ? [] : capabilities?.workspaces.filter(w => w.id === 'organization.workspace' && !venues.some(v => v.context.id === w.context.id)) ?? [];
  const venueEntry = venuesOnly || (venues.length > 0 && organizations.length === 0);
  return <main className="venue-page">
    <header className="venue-workspace-heading">
      <div><h1>{venuesOnly ? t('nav.myVenues', 'My venues') : navigation ? t(navigation.translationKey, navigation.label) : t('nav.myOrganizations', 'My organizations')}</h1>
        <p>{venueEntry ? 'Open a venue workspace to manage its page, pitches, calendar and booking requests.' : 'Choose a workspace to manage your organization’s activities and team.'}</p></div>
      {hasNavigationCapability(capabilities, 'organization.create') && <Link className="venue-button" to={venueEntry ? '/organizations/create?kind=VENUE' : '/organizations/create'}>{venueEntry ? 'Add venue' : 'Add organization'}</Link>}
    </header>
    <Link className="venue-button" to="/club-operations">Club operations, appointments & permissions →</Link>
    {!venues.length && !organizations.length && <p role="status">{venuesOnly ? 'You don’t currently have a venue workspace. Create a venue organization to add pitches and start managing bookings.' : 'You don’t currently have an organization workspace. Your workspaces will appear here when you have access.'}</p>}
    {venuesOnly && <Link className="venue-link" to="/my-organizations">All my organizations</Link>}
    <div className="venue-owner-portfolio">
      {[...venues, ...organizations].map(workspace => {
        const id = workspace.context.id;
        const venue = workspace.id === 'venue.workspace';
        const settings = links.find(link => link.capability === 'organization.settings' && link.path === `/organizations/${id}?settings=1`);
        if (venue) return <VenueOwnerCard key={`${sessionId}/${id}`} id={id} label={workspace.context.label} settings={settings?.path}/>;
        return <article key={id} className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <Building2 className="mb-4 h-7 w-7 text-[var(--venue-accent)]" />
          <p className="venue-eyebrow">Organization</p>
          <h2 className="break-words">{workspace.context.label}</h2>
          <p className="mt-3 text-[var(--text-secondary)]">Your organization’s profile, activities and team.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="venue-button venue-button--primary" to={`/organizations/${id}`}><Settings2 size={16}/>Open workspace</Link>
          </div>
          {settings && <Link className="mt-4 inline-block text-sm underline" to={settings.path}>Organization settings</Link>}
        </article>;
      })}
    </div>
  </main>;
}
