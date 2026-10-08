import { createContext, useContext } from 'react';
import type { NavigationCapabilities } from '../../src/context/navigationCapabilities';
export interface PreviewUser { id: number; fullName: string; username: string; role: string; navigationCapabilities: NavigationCapabilities }
export const PreviewAuth = createContext<{ user: PreviewUser | null; sessionId: string }>({ user: null, sessionId: 'isolated-experience' });
export const useAuth = () => ({ ...useContext(PreviewAuth), refreshNavigationCapabilities: async () => {}, status: 'authenticated', isAuthenticated: true });
