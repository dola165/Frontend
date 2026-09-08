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
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 text-sm font-semibold text-[#a1a1aa] transition-colors hover:border-[#ffffff1a] hover:text-[#f4f4f5]"
            >
                <Command className="h-4 w-4" />
                <span className="hidden sm:inline">Quick actions</span>
                <kbd className="hidden rounded-md border border-[#ffffff0d] bg-[#0f1117] px-1.5 py-0.5 text-[10px] font-semibold text-[#71717a] sm:inline">⌘K</kbd>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[1600] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => {
                    if (event.currentTarget === event.target) {
                        setIsOpen(false);
                    }
                }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="landing-command-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#ffffff1a] bg-[#16181d] shadow-2xl">
                        <div className="flex items-center gap-3 border-b border-[#ffffff0d] px-4">
                            <Search className="h-4 w-4 shrink-0 text-[#71717a]" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setActiveIndex(0);
                                }}
                                placeholder="Search GrassKickZ actions..."
                                aria-label="Search quick actions"
                                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[#f4f4f5] outline-none placeholder:text-[#71717a]"
                            />
                            <kbd className="hidden rounded-md border border-[#ffffff0d] px-1.5 py-0.5 text-[10px] text-[#71717a] sm:inline">Esc</kbd>
                            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close quick actions" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#71717a] hover:bg-[#ffffff0d] hover:text-[#f4f4f5]">
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
                                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${index === activeIndex ? 'bg-[#16a34a]/10 text-[#f4f4f5]' : 'text-[#a1a1aa] hover:bg-[#ffffff0d] hover:text-[#f4f4f5]'}`}
                                        >
                                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${index === activeIndex ? 'bg-[#16a34a]/15 text-[#4ade80]' : 'bg-[#0f1117] text-[#71717a]'}`}>
                                                <action.icon className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold">{action.label}</span>
                                                <span className="mt-0.5 block truncate text-xs text-[#71717a]">{action.description}</span>
                                            </span>
                                            <span className="hidden text-xs text-[#71717a] sm:inline">↵</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="px-3 py-8 text-center text-sm text-[#a1a1aa]">No matching actions.</p>
                            )}
                        </div>
                        <div className="border-t border-[#ffffff0d] px-4 py-3 text-xs text-[#71717a]">
                            Use <span className="text-[#a1a1aa]">↑↓</span> to move, <span className="text-[#a1a1aa]">Enter</span> to choose, and <span className="text-[#a1a1aa]">Esc</span> to close.
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
