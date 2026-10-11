import type { WorldRole } from '../roles';

/** Words that make a job, trial or specialist more relevant to each kind of coach. */
const WORDS: Partial<Record<WorldRole, RegExp>> = {
    'goalkeeper-coach': /goal ?keep|keeper|\bgk\b/i,
    'fitness-coach': /fitness|conditioning|strength|physio|nutrition|sport science|athletic/i,
    analyst: /analys|scout|video|recruit|performance data/i,
    'assistant-coach': /assistant|coach/i,
    'head-coach': /head coach|coach/i,
    'team-manager': /team manager|kit|logistic|operation|match ?day/i,
    'academy-director': /director|head of|academy manager|technical/i,
};

/** 0 when the text speaks to the role, 1 otherwise: used only to order lists, never to hide anything. */
export const byRole = (role: WorldRole, text: string) => WORDS[role]?.test(text) ? 0 : 1;

/** A stable sort that puts what speaks to the role first. */
export function orderForRole<T>(items: T[], role: WorldRole, text: (item: T) => string) {
    return items.map((item, index) => ({ item, index, rank: byRole(role, text(item)) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index).map(entry => entry.item);
}

/** What the items that speak to a role are called when they are grouped first ("Goalkeepers"). */
export const ROLE_GROUP: Partial<Record<WorldRole, string>> = {
    'goalkeeper-coach': 'Goalkeepers', 'fitness-coach': 'Fitness and medical', analyst: 'Analysis and scouting',
    'team-manager': 'Team management', 'academy-director': 'Leading an academy',
};
