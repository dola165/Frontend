import type { TabItem } from '../../../design/Tabs';
import { arrangePath } from '../../world/compose/arrangeSeed';
import type { BoxKey } from '../../pages/model/kinds';

export type ClubTab = 'posts' | 'media' | 'about' | 'teams' | 'people' | 'facilities' | 'involved' | 'contact';
/** The three parts of Get involved, each a full page inside the club page. */
export type InvolvedKind = 'store' | 'jobs' | 'fundraising';

/** Posts first for everyone (the owner, 13 October); Contact is pushed to the right edge by the page's stylesheet. */
export const clubTabs: TabItem<ClubTab>[] = [
    { id: 'posts', label: 'Posts' },
    { id: 'media', label: 'Photos & videos' },
    { id: 'about', label: 'About' },
    { id: 'teams', label: 'Teams & training' },
    { id: 'people', label: 'Coaches & staff' },
    { id: 'facilities', label: 'Facilities' },
    { id: 'involved', label: 'Get involved' },
    { id: 'contact', label: 'Contact' },
];

const ids = new Set<string>(clubTabs.map(tab => tab.id));

/** The side boxes a tab already shows in full: beside that tab they shrink to their name, never the same list twice. */
export const boxesShownBy: Partial<Record<ClubTab, BoxKey[]>> = { teams: ['squads'], people: ['staff'], facilities: ['grounds'], contact: ['contact'] };

/** Old links keep working: the overview and honours are About; `pictures`/`videos` are the media tab; the store, campaigns and opportunities are Get involved. */
export function clubTabFrom(value: string | null): ClubTab {
    if (value === 'pictures' || value === 'videos') return 'media';
    if (value === 'overview' || value === 'honours') return 'about';
    if (value === 'business' || value === 'store' || value === 'campaigns') return 'involved';
    return value && ids.has(value) ? value as ClubTab : 'posts';
}

/** Which part of Get involved a link opens: `show=` first, then the old `tab=store|campaigns` and `opportunity=jobs` links. */
export function involvedKindFrom(params: URLSearchParams): InvolvedKind {
    const show = params.get('show');
    if (show === 'jobs' || show === 'fundraising' || show === 'store') return show;
    if (params.get('tab') === 'campaigns') return 'fundraising';
    return params.get('opportunity') === 'jobs' ? 'jobs' : 'store';
}
/** Whether the club information column is folded away so the store, jobs or fundraising page gets the width. */
export const isWide = (params: URLSearchParams) => params.get('wide') === '1';
export const involvedPath = (clubId: number, kind: InvolvedKind) => `/clubs/${clubId}?tab=involved${kind === 'store' ? '' : `&show=${kind}`}`;

/** Filters that belong to one tab; switching tabs clears them so the next tab starts clean. */
export const tabFilters = ['programme', 'squad', 'age', 'q', 'staff', 'staffView', 'enquire', 'kind', 'type', 'period', 'week', 'view', 'opportunity', 'show', 'roleId', 'roleTitle', 'query', 'sort', 'page', 'state', 'category', 'collection', 'seller', 'country', 'city', 'variant', 'minPrice', 'maxPrice', 'currency', 'add'];

/** Where another club's staff arrange a match against this club. The form lives in World. */
export const proposeMatchPath = (clubId: number) => arrangePath({ mode: 'direct', opponentId: clubId });
/** Where this club's own staff start a match: invite a club, or post an open challenge for any club to take. */
export const openChallengePath = () => arrangePath({ mode: 'open' });
