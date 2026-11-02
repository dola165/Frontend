import { useAuth } from './AuthContext';
import { hasNavigationCapability } from './navigationCapabilities';

/**
 * Whether the server lists this capability for the signed-in person: undefined while the session is still being
 * checked, false for a guest. It decides which doors show; every endpoint still makes its own decision.
 */
export function useNavigationCapability(id: string): boolean | undefined {
    const { status, user } = useAuth();
    if (status === 'bootstrapping') return undefined;
    return status === 'authenticated' && hasNavigationCapability(user?.navigationCapabilities, id);
}
