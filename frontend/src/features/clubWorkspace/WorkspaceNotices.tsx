import { X } from 'lucide-react';
import { Button, PageFrame } from '../../design/primitives';
import './club-workspace.css';

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
