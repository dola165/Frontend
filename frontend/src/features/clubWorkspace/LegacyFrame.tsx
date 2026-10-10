import type { ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Button, PageFrame, PageHeader } from '../../design/primitives';
import '../../components/workspace/workspace-design-theme.css';
import '../clubOperations/workspace-experience.css';
import './club-workspace.css';

/**
 * Hosts a club tool that has not moved to the design system yet. It keeps the legacy
 * palette and styles those tools rely on, inside the shared workspace frame and gutter.
 */
export function LegacyFrame({ darkMode, area, tab, title, subtitle, back, children }: {
    darkMode: boolean; area: string; tab: string; title?: string; subtitle?: string;
    back?: { label: string; onClick: () => void }; children: ReactNode;
}) {
    return <PageFrame className="cw-legacy">
        {back && <div className="cw-legacy__back"><Button variant="ghost" size="sm" onClick={back.onClick}><ArrowLeft aria-hidden="true" />{back.label}</Button></div>}
        {title && <PageHeader title={title} subtitle={subtitle} />}
        <div data-workspace-area={area} data-workspace-page={tab} className={`workspace-page-shell club-workspace-shell workspace-refresh${darkMode ? '' : ' workspace-light'}`}>
            <div className="workspace-tab-content">{children}</div>
        </div>
    </PageFrame>;
}

/** Results of workspace actions, announced and dismissible, above whichever page is open. */
export function WorkspaceNotices({ error, success, rolesError, onDismissError, onDismissSuccess, onRetryRoles }: {
    error: string | null; success: string | null; rolesError: string | null;
    onDismissError: () => void; onDismissSuccess: () => void; onRetryRoles: () => void;
}) {
    if (!error && !success && !rolesError) return null;
    return <div className="cw-notices">
        <PageFrame className="gk-stack gk-stack--tight">
            {rolesError && <div className="gk-notice gk-notice--warning" role="alert"><span className="cw-notices__text">{rolesError}</span><Button size="sm" onClick={onRetryRoles}>Try again</Button></div>}
            {error && <div className="gk-notice gk-notice--danger" role="alert" aria-live="assertive"><span className="cw-notices__text">{error}</span><Button size="sm" variant="ghost" iconOnly aria-label="Dismiss error" onClick={onDismissError}><X aria-hidden="true" /></Button></div>}
            {success && <div className="gk-notice cw-notices__success" role="status" aria-live="polite"><span className="cw-notices__text">{success}</span><Button size="sm" variant="ghost" iconOnly aria-label="Dismiss confirmation" onClick={onDismissSuccess}><X aria-hidden="true" /></Button></div>}
        </PageFrame>
    </div>;
}
