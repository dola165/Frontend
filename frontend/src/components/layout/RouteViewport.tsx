import { Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '../ErrorBoundary';
import '../../styles/workspace-design.css';
import '../../styles/product-design.css';
import { useProductDesign } from './productDesign';

// Public destinations keep their own visual treatment. Private work surfaces
// share one palette and layout foundation, including their nested editors.
const workspaceSurface = (pathname: string): string | undefined => {
    if (/^\/clubs\/\d+\/(workspace|operations|profile-settings|squads)$/.test(pathname)) return 'club';
    if (/^\/organizations\/\d+\/workspace$/.test(pathname) || pathname === '/organizations/create') return 'organization';
    if (/^\/stadiums\/\d+\/manage$/.test(pathname)) return 'venue';
    if (/^\/tournaments\/\d+\/workspace$/.test(pathname) || pathname === '/tournaments/setup') return 'tournament';
    if (/^\/squads(?:\/\d+)?$/.test(pathname)) return 'squad';
    if (pathname === '/referees/me') return 'referee';
    if (pathname === '/agent' || pathname === '/agent/dashboard') return 'agent';
    if (pathname === '/parent' || pathname === '/parent/enrollment') return 'family';
    if (pathname === '/calendar') return 'schedule';
    if (pathname === '/messages') return 'messages';
    if (pathname === '/admin') return 'admin';
    if (['/workspaces', '/club-operations', '/my-club', '/my-organizations', '/volunteering', '/event-venues'].includes(pathname)) return 'connections';
    return undefined;
};

/** Keep navigation and the auth provider mounted while the selected page loads. */
export const RouteViewport = ({ children }: { children: ReactNode }) => {
    const { pathname } = useLocation();
    const { t } = useTranslation();
    const surface = workspaceSurface(pathname);
    const product = useProductDesign(pathname);
    return <ErrorBoundary key={pathname}>
        <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center p-6 text-[color:var(--text-secondary)]">
            {t('app.loadingPage')}
        </div>}>
            <div className={`app-route-arrival${surface ? ' workspace-design-scope' : ''}${product ? ' product-design-scope' : ''}`} data-workspace-surface={surface} data-product-surface={product}>{children}</div>
        </Suspense>
    </ErrorBoundary>;
};
