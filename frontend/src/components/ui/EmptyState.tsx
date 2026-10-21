import type { ReactNode } from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import './workflow-ui.css';

type StateAction = { label: string; to: string } | { label: string; onClick: () => void };

/** A real empty result: explain this space and offer only an available next step. */
export function EmptyState({ icon: Icon, title, description, action, compact = false, children, iconElement }: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: StateAction;
    compact?: boolean;
    children?: ReactNode;
    iconElement?: ReactNode;
}) {
    return <div className={`gk-empty ${compact ? 'gk-empty--compact' : ''}`}>
        <span className="gk-empty__icon" aria-hidden="true">{iconElement ?? <Icon size={24} strokeWidth={1.65} />}</span>
        <div className="gk-empty__body">
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {children}
            {action && ('to' in action
                ? <Link className="gk-state-action" to={action.to}>{action.label}<ArrowRight size={16} aria-hidden="true" /></Link>
                : <button type="button" className="gk-state-action" onClick={action.onClick}>{action.label}<ArrowRight size={16} aria-hidden="true" /></button>)}
        </div>
    </div>;
}
