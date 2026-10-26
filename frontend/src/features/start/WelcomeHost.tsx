import { lazy, Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CREATE_PARAM } from '../pages/create/entry';
import { usePreferences } from '../preferences/preferencesStore';
import { stepFromParam, stepFromStored, WELCOME_PARAM } from './welcomeSteps';

const WelcomeDialog = lazy(() => import('./WelcomeDialog').then(module => ({ default: module.WelcomeDialog })));

/**
 * Mounted on Home: shows the welcome over it while the address says `?welcome=` (a plain sign-up goes to `/start`,
 * which leads here; every other door lands in what the person came for). A welcome left open on another visit comes
 * back where it was; one that was finished or skipped never opens by itself again.
 */
export function WelcomeHost() {
    const { user, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const progress = usePreferences(user?.id).start?.welcome;
    const step = stepFromParam(params.get(WELCOME_PARAM));
    // A welcome left open comes back, but never over another sheet the address asks for (creating a page).
    const resume = !step && !params.has(CREATE_PARAM) && progress?.state === 'OPEN' ? stepFromStored(progress.at) ?? 'start' : null;
    // Once shown on this visit, closing it is final even before the save that says so has landed.
    const shown = useRef(false);
    useEffect(() => { if (step) shown.current = true; }, [step]);
    useEffect(() => {
        if (resume && !shown.current) setParams(current => { const next = new URLSearchParams(current); next.set(WELCOME_PARAM, resume); return next; }, { replace: true });
    }, [resume, setParams]);
    if (!user || !step) return null;
    return <Suspense fallback={null}><WelcomeDialog key={`${user.id}:${sessionId}`} step={step} /></Suspense>;
}
