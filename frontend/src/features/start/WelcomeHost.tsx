import { lazy, Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../preferences/preferencesStore';
import { stepFromParam, stepFromStored, WELCOME_PARAM } from './welcomeSteps';

const WelcomeDialog = lazy(() => import('./WelcomeDialog').then(module => ({ default: module.WelcomeDialog })));

/**
 * Mounted on Home: shows the welcome over it while the address says `?welcome=` (sign-up sends new accounts to
 * `/start`, which leads here). A popup left open on another visit comes back where it was; one that was finished or
 * closed never opens by itself again, and existing accounts only get it from Account › Roles and work.
 */
export function WelcomeHost() {
    const { user, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const progress = usePreferences(user?.id).start?.welcome;
    const step = stepFromParam(params.get(WELCOME_PARAM));
    const resume = !step && progress?.state === 'OPEN' ? stepFromStored(progress.at) ?? 'roles' : null;
    // Once shown on this visit, closing it is final even before the save that says so has landed.
    const shown = useRef(false);
    useEffect(() => { if (step) shown.current = true; }, [step]);
    useEffect(() => {
        if (resume && !shown.current) setParams(current => { const next = new URLSearchParams(current); next.set(WELCOME_PARAM, resume); return next; }, { replace: true });
    }, [resume, setParams]);
    if (!user || !step) return null;
    return <Suspense fallback={null}><WelcomeDialog key={`${user.id}:${sessionId}`} step={step} /></Suspense>;
}
