import type { CompetitionRules, Structure } from '../../competitions/api';

/** The pictures a tournament's format is drawn as. */
export type ShapeKind = 'league' | 'cup' | 'groups' | 'swiss' | 'festival' | 'ladder';

const KIND: Record<Structure, ShapeKind> = {
    ROUND_ROBIN: 'league', HOME_AWAY: 'league', SPLIT_LEAGUE: 'league', SWISS: 'swiss', KNOCKOUT: 'cup', GROUPS_KNOCKOUT: 'groups',
    LADDER: 'ladder', ROTATION: 'festival', KING_OF_PITCH: 'festival',
};

/** What a format is called on a row, in football words ("Knockout cup", "Groups & finals"). */
export const FORMAT_WORD: Record<Structure, string> = {
    ROUND_ROBIN: 'League', HOME_AWAY: 'Home & away league', SPLIT_LEAGUE: 'Split league', SWISS: 'Swiss rounds', KNOCKOUT: 'Knockout cup',
    GROUPS_KNOCKOUT: 'Groups & finals', LADDER: 'Ladder', ROTATION: 'Festival', KING_OF_PITCH: 'King of the Pitch',
};

/** A tournament's shape as planned: its picture, its format in words, and how many places it has and has filled. */
export interface PlannedShape { kind: ShapeKind; structure: Structure; word: string; places: number | null; entered: number | null }

/**
 * The planned layer of a tournament's shape, from its published rules and places: all a list row can draw before the
 * draw (the draw's own groups, routes and progress are later layers). Null when the rules are not published (a legacy
 * tournament).
 */
export function plannedShape(rules: Pick<CompetitionRules, 'structure'> | null | undefined, entryCap?: number | null, entryCount?: number | null): PlannedShape | null {
    const structure = rules?.structure;
    if (!structure || !KIND[structure]) return null;
    return { kind: KIND[structure], structure, word: FORMAT_WORD[structure], places: entryCap ?? null, entered: entryCount ?? null };
}
