import { accessibleClubs } from '../clubAccess';
import type { LucideIcon } from 'lucide-react';
import type { NavigationCapabilities } from '../../../context/navigationCapabilities';

export type PrimarySection = 'home' | 'world' | 'my-squads' | 'projects' | 'club-office' | 'parent-hub';
export interface PrimaryTab { id: PrimarySection; to: string; label: string; icon: LucideIcon; current: boolean }

export interface MyClub { ids: number[]; path: string | null }

/**
 * The person's own club (they belong to one in the product model), which Home's left side opens: its page. Agent
 * engagements are not membership. A club the person works at wins over a membership elsewhere: capabilities are
 * known at sign-in while the membership loads later, so the target stays the same once the page has loaded.
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

const discoveryRoute = /^\/(?:world|map|stadiums|match-history|match-exchange|tournaments|tryouts|events|jobs|roles|store|campaigns|admissions\/opportunities)(?:\/|$)/;

/**
 * Club office's tab (step 2, 28 October 2026): for the Owner and Admins, and for anyone whose job has no page of its
 * own yet. Coaches have My squads and parents Parent Hub; the club page is on Home's left side.
 */
export function clubOffice(capabilities: NavigationCapabilities | undefined): { id: number; path: string } | null {
    const entry = capabilities?.workspaces.find(item => item.id === 'club.office');
    return entry ? { id: entry.context.id, path: `/clubs/${entry.context.id}/office` } : null;
}

/**
 * Projects' tab (step 4): for the jobs that run every project (Commercial, Facilities coordinator), and for anyone else
 * on the staff while they are on an open project. Parents and volunteers on a project find it on Home instead.
 */
export function clubProjects(capabilities: NavigationCapabilities | undefined): { id: number; path: string } | null {
    const entry = capabilities?.workspaces.find(item => item.id === 'club.projects');
    return entry ? { id: entry.context.id, path: `/projects?club=${entry.context.id}` } : null;
}

/** Which primary tab a location belongs to. Work surfaces outside the places, and the person's own club page, return null. */
export function primarySectionFor(pathname: string, ownClubIds: number[], search = ''): PrimarySection | null {
    if (pathname === '/home' || pathname === '/feed' || pathname.startsWith('/posts/')) return 'home';
    if (/^\/clubs\/\d+\/office(?:\/|$)/.test(pathname)) return 'club-office';
    if (pathname === '/projects' || pathname.startsWith('/projects/')) return 'projects';
    // The squad page is shared: a parent arrives from Parent Hub with the child in the address.
    if (pathname.startsWith('/squads/') && new URLSearchParams(search).has('player')) return 'parent-hub';
    if (pathname === '/my-squads' || pathname === '/squads' || pathname.startsWith('/squads/')) return 'my-squads';
    if (pathname === '/parent' || pathname.startsWith('/parent/')) return 'parent-hub';
    const club = /^\/clubs\/(\d+)(?:\/|$)/.exec(pathname);
    if (club) return ownClubIds.includes(Number(club[1])) ? null : 'world';
    if (/^\/tournaments\/\d+\/workspace$/.test(pathname)) return null;
    if (pathname === '/clubs' || pathname === '/clubs/following' || discoveryRoute.test(pathname)) return 'world';
    return null;
}
