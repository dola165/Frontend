import { useAuth } from '../../../context/AuthContext';
import { accessibleClubs } from '../../../components/layout/clubAccess';
import { useWorldChild } from '../players';

/** Who World's front page is for: it shows each a different set of tiles, in a different order. */
export type WorldAudience = 'parent' | 'coach' | 'member';

/**
 * The same relationships that give the top bar its role tabs: a parent searching for a child sees the
 * parent's front page; anyone who coaches a squad (My squads) sees the coach's; everyone else the general one.
 */
export function useWorldAudience(): WorldAudience {
    const { user } = useAuth();
    const { child } = useWorldChild();
    if (child) return 'parent';
    if (accessibleClubs(user?.navigationCapabilities).some(club => club.canOpenWorkspace)) return 'coach';
    return 'member';
}
