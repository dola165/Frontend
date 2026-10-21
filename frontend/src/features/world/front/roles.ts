import type { WorldAudience } from './audience';

/**
 * Who the person is on World: it decides which list a tab opens on and the likely answer its filters start with.
 * It follows their confirmed links (coaching, a child, a place as a player, refereeing), never a choice of their own.
 */
export type WorldRole = 'head-coach' | 'assistant-coach' | 'goalkeeper-coach' | 'fitness-coach' | 'analyst' | 'team-manager' | 'academy-director'
    | 'club-admin' | 'specialist' | 'parent' | 'player' | 'referee' | 'fan' | 'agent' | 'organiser' | 'venue-operator';

/** The role the person's relationships suggest: coaching, a chosen child, playing for a club. */
export function defaultRole(audience: WorldAudience, clubRole?: string | null): WorldRole {
    if (audience === 'coach') return 'head-coach';
    if (audience === 'parent') return 'parent';
    return clubRole === 'PLAYER' ? 'player' : 'fan';
}
