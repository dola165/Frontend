import '../ui/workflow-ui.css';
import { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    actionIcon?: LucideIcon;
    onAction?: () => void;
    autoFocus?: boolean;
}

export const EmptyStateCard = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    actionIcon: ActionIcon,
    onAction,
    autoFocus
}: EmptyStateCardProps) => {
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (autoFocus && btnRef.current) {
            btnRef.current.focus();
        }
    }, [autoFocus]);

    return (
        <div className="gk-empty">
            <span className="gk-empty__icon" aria-hidden="true"><Icon size={24} strokeWidth={1.65}/></span><div className="gk-empty__body">
            <h3 className="gk-empty__title">{title}</h3>
            <p className="gk-empty__description">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    ref={btnRef}
                    type="button"
                    onClick={onAction}
                    className="gk-state-action"
                >
                    {ActionIcon && <ActionIcon className="h-4 w-4" />}
                    {actionLabel}
                </button>
            )}
        </div></div>
    );
};
