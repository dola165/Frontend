import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ACTIONS, OPENED_HERE, type ActionHints, type ActionKey, type ActionSubject } from './registry';
import { useAction } from './useAction';
import './actions.css';

/**
 * One action as a button anywhere: nothing unless the person may do it, else a link that opens the flow over this page
 * with the likely answer chosen. While the checker answers it stands on the screen's own flag, dimmed. `look="row"`
 * is a boxed row with an arrow (Parent Hub's side column), `look="menu"` a menu item.
 */
export function ActionButton({ action, subject, hints, fallback, variant = 'secondary', size = 'md', label, short = false, look = 'button', role, hint, className, at, onClick }: {
    action: ActionKey; subject?: ActionSubject; hints?: ActionHints; fallback?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost'; size?: 'md' | 'sm'; label?: string; short?: boolean;
    look?: 'button' | 'row' | 'menu'; /** A menu item's role: `menuitem` in a menu, none in a sheet of links. */ role?: 'menuitem'; hint?: ReactNode; className?: string;
    /** The page to open the flow over, when not this one. */ at?: { pathname: string; search: string }; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
    const copy = useJourneyCopy();
    const state = useAction(action, subject, { hints, fallback, at });
    if (!state.allowed || !state.href) return null;
    const definition = ACTIONS[action];
    const Icon = definition.icon;
    const text = label ?? copy(...(short ? definition.short : definition.label));
    const icon = <Icon aria-hidden="true" className="gk-action__icon" style={definition.color && !(look === 'button' && variant === 'primary') ? { color: definition.color } : undefined} />;
    const busy = state.loading || undefined;
    if (look === 'menu') return <Link role={role} to={state.href} state={OPENED_HERE} className="gk-menu__item gk-action-item" aria-disabled={busy} onClick={onClick}>{icon}{text}</Link>;
    if (look === 'row') return <Link to={state.href} state={OPENED_HERE} className={`gk-action-row${className ? ` ${className}` : ''}`} aria-disabled={busy} onClick={onClick}>
        <span className="gk-action-row__icon" aria-hidden="true">{icon}</span>
        <span className="gk-action-row__text"><strong>{text}</strong>{hint && <small>{hint}</small>}</span>
        <ArrowRight aria-hidden="true" className="gk-action-row__arrow" />
    </Link>;
    return <ButtonLink to={state.href} state={OPENED_HERE} variant={variant} size={size} className={`gk-action${className ? ` ${className}` : ''}`} aria-disabled={busy} onClick={onClick}>{icon}{text}</ButtonLink>;
}
