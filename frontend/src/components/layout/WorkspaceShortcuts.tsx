import { organizationNavigation } from './organizationNavigation';
import { useTranslation } from 'react-i18next';
import { ShortcutEmblem } from './ShortcutEmblem';
import { Link } from 'react-router-dom';
import { workspaceLinks, type NavigationCapabilities } from '../../context/navigationCapabilities';

export interface ManagedClubLink { clubId: number; clubName: string }

/** Keep detailed destinations inside a workspace or the organization collection. */
export function WorkspaceShortcuts({ clubs = [], navigationCapabilities }: { clubs?: ManagedClubLink[]; navigationCapabilities?: NavigationCapabilities }) {
    const { t } = useTranslation();
    const organization = organizationNavigation(navigationCapabilities);
    const links = workspaceLinks(navigationCapabilities).filter(link => ['club.workspace','club.operations','club.work'].includes(link.capability));
    const preferred = `/clubs/${clubs[0]?.clubId}/workspace`;
    const path = navigationCapabilities !== undefined
        ? (links.find(link => link.path === preferred) ?? links[0])?.path
        : clubs.length ? preferred : undefined;
    if (!path && !organization) return null;
    return <>
    {path && <Link to={path} className="feed-side-link home-social-link workspace-shortcut">
        <ShortcutEmblem kind="club" />
        <span className="min-w-0 flex-1 text-sm font-semibold">Club workspace</span>
    </Link>}
    {organization && <Link to={organization.path} className="feed-side-link home-social-link workspace-shortcut">
      <ShortcutEmblem kind={organization.label === 'My venues' ? 'venues' : 'organization'} />
      <span className="min-w-0 flex-1 text-sm font-semibold">{t(organization.translationKey, organization.label)}</span>
    </Link>}
    </>;
}
