import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface LandingCommandAction {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    keywords?: string[];
    onSelect: () => void;
}

interface LandingCommandPaletteProps {
    actions: LandingCommandAction[];
}

export const LandingCommandPalette = ({ actions }: LandingCommandPaletteProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const filteredActions = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) {
            return actions;
        }

        return actions.filter((action) => {
            const haystack = [action.label, action.description, ...(action.keywords ?? [])].join(' ').toLocaleLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [actions, query]);

    const open = useCallback(() => {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
        setQuery('');
        setActiveIndex(0);
        setIsOpen(true);
    }, []);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
                event.preventDefault();
                open();
            }
        };

        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, [open]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        window.requestAnimationFrame(() => inputRef.current?.focus());

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setIsOpen(false);
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((current) => filteredActions.length === 0 ? 0 : (current + 1) % filteredActions.length);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => filteredActions.length === 0 ? 0 : (current - 1 + filteredActions.length) % filteredActions.length);
                return;
            }

            if (event.key === 'Enter' && filteredActions[activeIndex]) {
                event.preventDefault();
                filteredActions[activeIndex].onSelect();
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeIndex, filteredActions, isOpen]);

    useEffect(() => {
        if (isOpen) {
            return;
        }

        previousFocusRef.current?.focus();
        previousFocusRef.current = null;
    }, [isOpen]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                aria-label="Open quick actions"
                aria-keyshortcuts="Control+K Meta+K"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-secondary)] transition-colors hover:border-[color-mix(in_srgb,_var(--color-border)_10.2%,_transparent)] hover:text-[var(--color-text)]"
            >
                <Command className="h-4 w-4" />
                <span className="hidden sm:inline">Quick actions</span>
                <kbd className="hidden rounded-md border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-secondary)] sm:inline">⌘K</kbd>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[1600] flex items-start justify-center bg-[color:var(--color-overlay)]/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => {
                    if (event.currentTarget === event.target) {
                        setIsOpen(false);
                    }
                }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="landing-command-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-[color-mix(in_srgb,_var(--color-border)_10.2%,_transparent)] bg-[var(--color-surface)] shadow-2xl">
                        <div className="flex items-center gap-3 border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4">
                            <Search className="h-4 w-4 shrink-0 text-[var(--color-secondary)]" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setActiveIndex(0);
                                }}
                                placeholder="Search GrassKickZ actions..."
                                aria-label="Search quick actions"
                                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-secondary)]"
                            />
                            <kbd className="hidden rounded-md border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-1.5 py-0.5 text-[10px] text-[var(--color-secondary)] sm:inline">Esc</kbd>
                            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close quick actions" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-secondary)] hover:bg-[color-mix(in_srgb,_var(--color-ink)_5.1%,_transparent)] hover:text-[var(--color-text)]">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="px-4 py-3">
                            <h2 id="landing-command-title" className="sr-only">GrassKickZ quick actions</h2>
                            {filteredActions.length > 0 ? (
                                <div role="listbox" aria-label="Quick actions" className="space-y-1">
                                    {filteredActions.map((action, index) => (
                                        <button
                                            key={action.id}
                                            type="button"
                                            role="option"
                                            aria-selected={index === activeIndex}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            onClick={() => {
                                                action.onSelect();
                                                setIsOpen(false);
                                            }}
                                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${index === activeIndex ? 'bg-[var(--color-accent)]/10 text-[var(--color-text)]' : 'text-[var(--color-secondary)] hover:bg-[color-mix(in_srgb,_var(--color-ink)_5.1%,_transparent)] hover:text-[var(--color-text)]'}`}
                                        >
                                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${index === activeIndex ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' : 'bg-[var(--color-surface)] text-[var(--color-secondary)]'}`}>
                                                <action.icon className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold">{action.label}</span>
                                                <span className="mt-0.5 block truncate text-xs text-[var(--color-secondary)]">{action.description}</span>
                                            </span>
                                            <span className="hidden text-xs text-[var(--color-secondary)] sm:inline">↵</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="px-3 py-8 text-center text-sm text-[var(--color-secondary)]">No matching actions.</p>
                            )}
                        </div>
                        <div className="border-t border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3 text-xs text-[var(--color-secondary)]">
                            Use <span className="text-[var(--color-secondary)]">↑↓</span> to move, <span className="text-[var(--color-secondary)]">Enter</span> to choose, and <span className="text-[var(--color-secondary)]">Esc</span> to close.
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
