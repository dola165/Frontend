import { GkRoot } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { TeamWorkDola } from '../teamWork/TeamWorkDola';
import { notifyAgentDolaChanged } from './agentDolaEvents';
import { DolaGuideOverlay } from './DolaGuideOverlay';
import './dola-guide.css';

/**
 * Agent Dola for the whole app: the panel (which shows nothing to anyone Dola is not offered to) and the guide that
 * frames fields on whatever page the person is filling in. Approved changes are announced so Team work reloads.
 */
export function AgentDolaDock() {
    const { status, user } = useAuth();
    if (status !== 'authenticated' || !user) return null;
    return <GkRoot className="agent-dola-dock">
        <TeamWorkDola onChanged={notifyAgentDolaChanged} />
        <DolaGuideOverlay />
    </GkRoot>;
}
