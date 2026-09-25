import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLayoutEffect, useRef } from 'react';

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
    return <div ref={container} className="entity-tabs overflow-x-auto border-b border-[#ffffff0d]">
        <div className="flex min-w-max items-stretch gap-5">
            {items.map((item) => {
                const isActive = item.id === activeId;
                const content = (
                    <>
                        <span>{item.label}</span>
                        {item.badge != null && item.badge !== '' && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${isActive ? 'bg-[#16a34a]-soft text-[#16a34a]' : 'bg-inset text-[#a1a1aa]'}`}>
                                {item.badge}
                            </span>
                        )}
                        {item.kind === 'page' && (
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isActive ? 'translate-x-0.5' : 'text-[#a1a1aa] group-hover:translate-x-0.5'}`} />
                        )}
                    </>
                );

                const className = `${baseClassName} ${isActive ? 'border-[color:#16a34a] text-[#f4f4f5]' : 'border-transparent text-[#a1a1aa] hover:text-[#f4f4f5]'}`;

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
