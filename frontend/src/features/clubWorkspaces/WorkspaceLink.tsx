import { Link, useNavigate, type LinkProps } from 'react-router-dom';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';

/** Real links support new tabs; ordinary navigation participates in the canonical unsaved-editor guard. */
export function WorkspaceLink({ onClick, ...props }: LinkProps) {
    const navigate = useNavigate();
    return <Link {...props} className={['job-workspaces__link', props.className].filter(Boolean).join(' ')} onClick={event => {
        onClick?.(event);
        if (event.defaultPrevented || props.target && props.target !== '_self' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        guardWorkspaceNavigation(() => navigate(props.to, { replace: props.replace, state: props.state }));
    }} />;
}
