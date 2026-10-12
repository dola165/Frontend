/** The kinds of thing World's drawers show (`peek=person-12`): the address, the drawers and their contents agree on these. */
export const DRAWER_KINDS = ['person', 'job', 'club', 'match', 'tournament', 'venue', 'trial', 'group', 'arrange', 'organiser'] as const;
export type DrawerKind = typeof DRAWER_KINDS[number];
