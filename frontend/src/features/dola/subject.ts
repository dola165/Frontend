/** The one thing on screen a question is probably about: the squad, child, listing or page the person has open. */
export type DolaSubjectKind = 'SQUAD' | 'CHILD' | 'CLUB' | 'ORGANIZATION' | 'JOB' | 'FUNDRAISER' | 'PRODUCT' | 'TOURNAMENT' | 'MATCH_CHALLENGE' | 'PERSON';
export interface DolaSubject { kind: DolaSubjectKind; id: number; label?: string }

const pages: [RegExp, DolaSubjectKind][] = [
    [/^\/squads\/(\d+)(?:\/|$)/, 'SQUAD'],
    [/^\/jobs\/(\d+)$/, 'JOB'],
    [/^\/campaigns\/(\d+)$/, 'FUNDRAISER'],
    [/^\/store\/products\/(\d+)$/, 'PRODUCT'],
    [/^\/tournaments\/(\d+)(?:\/|$)/, 'TOURNAMENT'],
    [/^\/match-exchange\/(\d+)$/, 'MATCH_CHALLENGE'],
    [/^\/profile\/(\d+)$/, 'PERSON'],
    [/^\/organizations\/(\d+)(?:\/|$)/, 'ORGANIZATION'],
    [/^\/clubs\/(\d+)(?:\/|$)/, 'CLUB'],
];

/**
 * Read from the address only, so Dola and the screen agree: the page's own record first; on Parent Hub the chosen
 * child (`?player=`, else the one remembered for this session). The server still decides what the person may read.
 */
export function dolaSubject(pathname: string, search: string, rememberedChild?: number): DolaSubject | null {
    for (const [pattern, kind] of pages) {
        const match = pattern.exec(pathname);
        if (match) return { kind, id: Number(match[1]) };
    }
    // My squads keeps the squad in focus in its address.
    if (pathname === '/my-squads') {
        const id = Number(new URLSearchParams(search).get('squad'));
        return Number.isSafeInteger(id) && id > 0 ? { kind: 'SQUAD', id } : null;
    }
    if (pathname === '/parent' || pathname.startsWith('/parent/')) {
        const id = Number(new URLSearchParams(search).get('player')) || rememberedChild;
        return id && Number.isSafeInteger(id) && id > 0 ? { kind: 'CHILD', id } : null;
    }
    return null;
}

export const dolaSubjectWord = (kind: DolaSubjectKind, ka: boolean): string => (ka ? {
    SQUAD: 'ეს გუნდი', CHILD: 'ეს ბავშვი', CLUB: 'ეს კლუბი', ORGANIZATION: 'ეს გვერდი', JOB: 'ეს განცხადება', FUNDRAISER: 'ეს კამპანია',
    PRODUCT: 'ეს ნივთი', TOURNAMENT: 'ეს ტურნირი', MATCH_CHALLENGE: 'ეს მატჩი', PERSON: 'ეს ადამიანი',
} : {
    SQUAD: 'This squad', CHILD: 'This child', CLUB: 'This club', ORGANIZATION: 'This page', JOB: 'This listing', FUNDRAISER: 'This fundraiser',
    PRODUCT: 'This product', TOURNAMENT: 'This tournament', MATCH_CHALLENGE: 'This match', PERSON: 'This person',
})[kind];
