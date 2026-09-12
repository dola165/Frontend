import { Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '../ErrorBoundary';

/** Keep navigation and the auth provider mounted while the selected page loads. */
export const RouteViewport = ({ children }: { children: ReactNode }) => {
    const { pathname } = useLocation();
    const { t } = useTranslation();
    return <ErrorBoundary key={pathname}>
        <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center p-6 text-[color:var(--text-secondary)]">
            {t('app.loadingPage')}
        </div>}>
            {children}
        </Suspense>
    </ErrorBoundary>;
};
