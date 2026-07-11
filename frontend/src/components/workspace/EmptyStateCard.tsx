import { useEffect, useRef, type LucideIcon } from 'react';

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
        <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-6 py-16 text-center">
            <Icon className="mx-auto h-8 w-8 text-[var(--fc-accent)]" />
            <h3 className="mt-3 text-sm font-semibold text-[var(--fc-text-primary)]">{title}</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--fc-text-secondary)]">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    ref={btnRef}
                    type="button"
                    onClick={onAction}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--fc-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                    {ActionIcon && <ActionIcon className="h-4 w-4" />}
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
