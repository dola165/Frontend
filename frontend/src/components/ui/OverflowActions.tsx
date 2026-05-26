import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface OverflowActionItem {
    id: string;
    label: string;
    description?: string;
    icon?: ReactNode;
    tone?: 'default' | 'positive' | 'danger';
    disabled?: boolean;
    onSelect: () => void;
}

interface OverflowActionsProps {
    label?: string;
    items: OverflowActionItem[];
    className?: string;
}

export const OverflowActions = ({
    label = 'More actions',
    items,
    className = ''
}: OverflowActionsProps) => {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    return (
        <div ref={rootRef} className={`relative ${className}`.trim()}>
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen((current) => !current)}
                className="app-chip inline-flex h-10 w-10 items-center justify-center rounded-[4px] text-secondary transition-colors hover:text-primary"
            >
                <span className="sr-only">{label}</span>
                <MoreHorizontal className="h-4 w-4" />
            </button>

            {open ? (
                <div
                    id={menuId}
                    role="menu"
                    className="app-card absolute right-0 top-[calc(100%+8px)] z-20 min-w-[240px] rounded-[4px] p-2 shadow-float"
                >
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            onClick={() => {
                                item.onSelect();
                                setOpen(false);
                            }}
                            className={`flex w-full items-start gap-3 rounded-[4px] px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                item.tone === 'danger'
                                    ? 'text-[color:var(--state-danger)] hover:bg-[color:var(--state-danger-soft)]'
                                    : item.tone === 'positive'
                                        ? 'text-[color:var(--accent-primary)] hover:bg-accent-primary-soft'
                                        : 'text-primary hover:bg-inset'
                            }`}
                        >
                            {item.icon ? <span className="mt-0.5 shrink-0">{item.icon}</span> : null}
                            <span className="min-w-0">
                                <span className="block text-[11px] font-black uppercase tracking-[0.16em]">{item.label}</span>
                                {item.description ? <span className="mt-1 block text-sm leading-5 text-secondary">{item.description}</span> : null}
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
