import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLayoutEffect, useRef } from 'react';
import { SelectionIndicator } from '../ui/SelectionIndicator';

export interface EntityTabItem {
    id: string;
    label: string;
    badge?: string | number | null;
    href?: string;
    kind?: 'tab' | 'page';
}

interface EntityTabsProps {
    items: EntityTabItem[];
    activeId: string;
    onChange?: (id: string) => void;
}

const baseClassName =
    'group inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-semibold  transition-colors';

export const EntityTabs = ({ items, activeId, onChange }: EntityTabsProps) => {
    const container = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const rail = container.current;
        const active = rail?.querySelector<HTMLElement>('[aria-current="page"], [aria-pressed="true"]');
        if (!rail || !active || rail.scrollWidth <= rail.clientWidth) return;
        const item = active.getBoundingClientRect();
        const viewport = rail.getBoundingClientRect();
        if (item.left < viewport.left) rail.scrollLeft -= viewport.left - item.left + 12;
        else if (item.right > viewport.right) rail.scrollLeft += item.right - viewport.right + 12;
    }, [activeId]);
    return <div ref={container} className="entity-tabs overflow-x-auto border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">
        <div className="app-selection-rail flex min-w-max items-stretch gap-5">
            <SelectionIndicator value={activeId} />
            {items.map((item) => {
                const isActive = item.id === activeId;
                const content = (
                    <>
                        <span>{item.label}</span>
                        {item.badge != null && item.badge !== '' && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${isActive ? 'bg-[var(--color-accent)]-soft text-[var(--color-accent)]' : 'bg-inset text-[var(--color-secondary)]'}`}>
                                {item.badge}
                            </span>
                        )}
                        {item.kind === 'page' && (
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isActive ? 'translate-x-0.5' : 'text-[var(--color-secondary)] group-hover:translate-x-0.5'}`} />
                        )}
                    </>
                );

                const className = `${baseClassName} ${isActive ? 'border-[color:var(--color-accent)] text-[var(--color-text)]' : 'border-transparent text-[var(--color-secondary)] hover:text-[var(--color-text)]'}`;

                if (item.href) {
                    return (
                        <Link key={item.id} to={item.href} className={className} aria-current={isActive ? 'page' : undefined}>
                            {content}
                        </Link>
                    );
                }

                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onChange?.(item.id)}
                        className={className}
                        aria-pressed={isActive}
                    >
                        {content}
                    </button>
                );
            })}
        </div>
    </div>
};
