export type OpportunitySection = 'store' | 'campaigns' | 'jobs';
export type OpportunityReturnLocation = { pathname: string; search: string };
export type OpportunityReturnState = {
    opportunityReturn?: {
        section: OpportunitySection;
        pathname: string;
        search: string;
    };
};

const isValidClubId = (clubId: number | null | undefined): clubId is number =>
    typeof clubId === 'number' && Number.isSafeInteger(clubId) && clubId > 0;

const isSafeSearch = (search: unknown): search is string =>
    typeof search === 'string' && (search === '' || (search.startsWith('?') && !search.includes('#')));

const isClubHubTarget = (section: OpportunitySection, pathname: string, search: string) => {
    if (!/^\/clubs\/([1-9]\d*)$/.test(pathname)) return false;
    const params = new URLSearchParams(search);
    if (params.get('tab') !== null && params.get('tab') !== 'business') return false;
    if (section === 'jobs') {
        return params.get('opportunity') === null || params.get('opportunity') === 'jobs';
    }
    return params.get('opportunity') === null;
};

const isAllowedReturnTarget = (
    section: OpportunitySection,
    pathname: unknown,
    search: unknown,
): pathname is string => {
    if (typeof pathname !== 'string' || !isSafeSearch(search)) return false;
    if (section === 'store' && (pathname === '/store' || /^\/clubs\/([1-9]\d*)\/store$/.test(pathname))) {
        return true;
    }
    if (
        section === 'campaigns' &&
        (pathname === '/campaigns' || /^\/clubs\/([1-9]\d*)\/campaigns$/.test(pathname))
    ) {
        return true;
    }
    if (section === 'jobs' && (pathname === '/jobs' || /^\/clubs\/([1-9]\d*)$/.test(pathname))) {
        return pathname === '/jobs' || isClubHubTarget(section, pathname, search);
    }
    return isClubHubTarget(section, pathname, search);
};

export const opportunityReturnState = (
    section: OpportunitySection,
    location: OpportunityReturnLocation,
): OpportunityReturnState => ({
    opportunityReturn: {
        section,
        pathname: location.pathname,
        search: location.search || '',
    },
});

export const clubOpportunityReturnState = (
    section: OpportunitySection,
    clubId: number,
): OpportunityReturnState =>
    opportunityReturnState(section, { pathname: `/clubs/${clubId}`, search: '?tab=business' });

const fallbackTarget = (section: OpportunitySection, clubId?: number | null): OpportunityReturnLocation => {
    if (!isValidClubId(clubId)) return { pathname: `/${section === 'jobs' ? 'jobs' : section}`, search: '' };
    if (section === 'jobs') {
        return { pathname: `/clubs/${clubId}`, search: '?tab=business&opportunity=jobs' };
    }
    return { pathname: `/clubs/${clubId}/${section}`, search: '' };
};

export const getOpportunityReturnTarget = (
    section: OpportunitySection,
    state: unknown,
    clubId?: number | null,
): OpportunityReturnLocation => {
    if (state && typeof state === 'object' && !Array.isArray(state)) {
        const candidate = (state as OpportunityReturnState).opportunityReturn;
        if (
            candidate?.section === section &&
            isAllowedReturnTarget(section, candidate.pathname, candidate.search)
        ) {
            return { pathname: candidate.pathname, search: candidate.search };
        }
    }
    return fallbackTarget(section, clubId);
};
