import { accessibleClubs } from '../clubAccess';
import type { LucideIcon } from 'lucide-react';
import type { NavigationCapabilities } from '../../../context/navigationCapabilities';

export type PrimarySection = 'home' | 'world' | 'my-club' | 'my-squads' | 'parent-hub';
export interface PrimaryTab { id: PrimarySection; to: string; label: string; icon: LucideIcon; current: boolean }

export interface MyClub { ids: number[]; path: string | null }

/**
 * A person belongs to one club in the product model, so the tab always says "My Club".
 * Staff land on the private workspace; members on the club page. Agent engagements are not membership.
 * A workspace the person can open wins over a membership elsewhere: capabilities are known at sign-in while the
 * membership loads later, so the tab's target stays the same once the page has loaded.
 */
export function myClub(capabilities: NavigationCapabilities | undefined, membershipClubId: number | null): MyClub {
    if (capabilities === undefined) {
        return membershipClubId ? { ids: [membershipClubId], path: `/clubs/${membershipClubId}` } : { ids: [], path: null };
    }
    const clubs = accessibleClubs(capabilities).filter(club => club.relationships.some(relation => relation !== 'Agent engagement'));
    const ids = [...new Set([...clubs.map(item => item.id), ...(membershipClubId ? [membershipClubId] : [])])];
    const club = clubs.find(item => item.canOpenWorkspace) ?? clubs.find(item => item.id === membershipClubId) ?? clubs[0];
    // A membership the capability list does not describe still makes it the person's club.
    if (!club) return { ids, path: membershipClubId ? `/clubs/${membershipClubId}` : null };
    return { ids, path: `/clubs/${club.id}` };
}

const discoveryRoute = /^\/(?:world|map|people|stadiums|matches|match-history|match-exchange|tournaments|tryouts|events|jobs|roles|store|campaigns|admissions\/opportunities)(?:\/|$)/;

/** Which primary tab a location belongs to. Work surfaces outside the three places return null. */
export function primarySectionFor(pathname: string, ownClubIds: number[], search = ''): PrimarySection | null {
    if (pathname === '/home' || pathname === '/feed' || pathname.startsWith('/posts/')) return 'home';
    if (pathname === '/my-club') return 'my-club';
    // The squad page is shared: a parent arrives from Parent Hub with the child in the address.
    if (pathname.startsWith('/squads/') && new URLSearchParams(search).has('player')) return 'parent-hub';
    if (pathname === '/my-squads' || pathname === '/squads' || pathname.startsWith('/squads/')) return 'my-squads';
    if (pathname === '/parent' || pathname.startsWith('/parent/')) return 'parent-hub';
    const club = /^\/clubs\/(\d+)(?:\/|$)/.exec(pathname);
    if (club) return ownClubIds.includes(Number(club[1])) ? 'my-club' : 'world';
    if (/^\/tournaments\/\d+\/workspace$/.test(pathname)) return null;
    if (pathname === '/clubs' || pathname === '/clubs/following' || discoveryRoute.test(pathname)) return 'world';
    return null;
}
