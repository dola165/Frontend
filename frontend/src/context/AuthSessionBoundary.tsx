import { Fragment, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Retire account-owned route state, drafts, selected club and subscriptions.
// Token renewal keeps the same key and preserves the mounted shell.
export function AuthSessionBoundary({ children }: { children: ReactNode }) {
    const { sessionId, isBootstrapping } = useAuth();
    if (isBootstrapping) return <div role="status" className="p-6 text-center">Loading your account…</div>;
    return <Fragment key={sessionId}>{children}</Fragment>;
}
