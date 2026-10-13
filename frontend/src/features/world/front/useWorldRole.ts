import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { useWorldSession } from '../worldSession';
import { useWorldAudience } from './audience';
import { defaultRole, type WorldRole } from './roles';

/**
 * Who the person is on World, from their confirmed links only: anyone who coaches a squad is a coach, a chosen child
 * makes a parent, a place as a player a player, a referee's workspace a referee, an agent's hub an agent; everyone else
 * looks at World as a fan. Nothing is chosen or saved here.
 */
export function useWorldRole(): WorldRole {
    const audience = useWorldAudience();
    const { membership } = useWorldSession();
    const { user } = useAuth();
    const capabilities = user?.navigationCapabilities;
    if (audience === 'member') {
        if (hasNavigationCapability(capabilities, 'referee.workspace')) return 'referee';
        if (hasNavigationCapability(capabilities, 'agent.hub')) return 'agent';
    }
    return defaultRole(audience, membership?.myRole);
}
