import { createContext, useContext } from 'react';
export const FixtureAuth = createContext({ user: { id: 10, fullName: 'Synthetic adult' }, sessionId: 'fundraising-fixture' });
export const useAuth = () => ({ ...useContext(FixtureAuth), isAuthenticated: true, status: 'authenticated', refreshNavigationCapabilities: async () => {} });
