import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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
    'group inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-black uppercase tracking-[0.16em] transition-colors';

export const EntityTabs = ({ items, activeId, onChange }: EntityTabsProps) => (
    <div className="overflow-x-auto border-b border-subtle">
        <div className="flex min-w-max items-stretch gap-5">
            {items.map((item) => {
                const isActive = item.id === activeId;
                const content = (
                    <>
                        <span>{item.label}</span>
                        {item.badge != null && item.badge !== '' && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${isActive ? 'bg-accent-primary-soft accent-primary' : 'bg-inset text-secondary'}`}>
                                {item.badge}
                            </span>
                        )}
                        {item.kind === 'page' && (
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isActive ? 'translate-x-0.5' : 'text-secondary group-hover:translate-x-0.5'}`} />
                        )}
                    </>
                );

                const className = `${baseClassName} ${isActive ? 'border-[color:var(--accent-primary)] text-primary' : 'border-transparent text-secondary hover:text-primary'}`;

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
);
