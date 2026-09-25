import { hasNavigationCapability, type NavigationCapabilities } from '../../context/navigationCapabilities';

// Navigation reflects current access, never the user's self-described identity.
export function organizationNavigation(capabilities?: NavigationCapabilities) {
  const venues = capabilities?.workspaces.filter(w => w.id === 'venue.workspace') ?? [];
  const organizations = capabilities?.workspaces.filter(w => w.id === 'organization.workspace') ?? [];
  if (!venues.length && !organizations.length) return null;
  const onlyVenues = venues.length > 0 && organizations.every(org => venues.some(v => v.context.id === org.context.id));
  return onlyVenues
    ? { id: 'my-organizations', path: '/my-organizations', label: 'My venues', translationKey: 'nav.myVenues' }
    : { id: 'my-organizations', path: '/my-organizations', label: 'My organizations', translationKey: 'nav.myOrganizations' };
}

export const hasClubNavigation = (capabilities?: NavigationCapabilities) =>
  hasNavigationCapability(capabilities, 'club.workspace') || hasNavigationCapability(capabilities, 'club.player');

export const showSquadNavigation = (capabilities?: NavigationCapabilities) =>
  capabilities === undefined || hasNavigationCapability(capabilities, 'squad.workspace');
