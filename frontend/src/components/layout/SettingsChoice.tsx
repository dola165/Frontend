import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

interface SettingsChoiceProps {
    id: string;
    label: string;
    icon: LucideIcon;
    value: string;
    onChange: (value: string) => void;
    light: boolean;
    options: { value: string; label: string; note?: string; icon?: LucideIcon }[];
}

export function SettingsChoice({ id, label, icon: Icon, value, onChange, light, options }: SettingsChoiceProps) {
    const [expanded, setExpanded] = useState(false);
    const [position, setPosition] = useState({ left: 8, top: 8 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const selected = options.find(option => option.value === value);
    const buttonClass = `flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${light ? 'text-[color:var(--color-text)] hover:bg-[color:var(--color-inset)]' : 'text-[var(--color-muted)] hover:bg-[color:var(--color-ink)]/[0.06]'}`;

    const close = () => {
        setExpanded(false);
        triggerRef.current?.focus();
    };

    useLayoutEffect(() => {
        if (!expanded) return;
        const reposition = () => {
            const trigger = triggerRef.current;
            const panel = panelRef.current;
            if (!trigger || !panel) return;
            const row = trigger.getBoundingClientRect();
            const menu = trigger.closest('[role="menu"]')?.getBoundingClientRect() ?? row;
            const width = panel.getBoundingClientRect().width;
            const height = panel.getBoundingClientRect().height;
            // Prefer the left edge of the account menu. On narrow screens the
            // panel overlaps the menu and offers a back button, never a row below.
            const left = menu.left >= width + 16 ? menu.left - width - 8
                : menu.right + width + 16 <= window.innerWidth ? menu.right + 8 : 8;
            setPosition({ left, top: Math.max(8, Math.min(row.top, window.innerHeight - height - 8)) });
        };
        reposition();
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [expanded]);

    useEffect(() => {
        if (!expanded) return;
        panelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
        const dismissOutside = (event: MouseEvent) => {
            if (!triggerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setExpanded(false);
        };
        document.addEventListener('mousedown', dismissOutside);
        return () => document.removeEventListener('mousedown', dismissOutside);
    }, [expanded]);

    return (
        <div role="group" aria-label={label}>
            <button
                id={`${id}-trigger`}
                ref={triggerRef}
                type="button"
                role="menuitem"
                aria-expanded={expanded}
                aria-controls={`${id}-options`}
                aria-haspopup="menu"
                onClick={() => setExpanded(open => !open)}
                onKeyDown={event => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                        event.preventDefault();
                        setExpanded(true);
                    }
                }}
                className={buttonClass}
            >
                <Icon className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                <span className="shrink-0 font-medium">{label}</span>
                <span className={`ml-auto min-w-0 text-right text-[11px] leading-tight ${light ? 'text-[color:var(--color-muted)]' : 'text-[var(--color-secondary)]'}`}>{selected?.label}</span>
                <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            </button>
            {expanded && createPortal(<div
                id={`${id}-options`}
                ref={panelRef}
                role="menu"
                aria-label={label}
                data-account-settings-panel=""
                style={{ position: 'fixed', ...position, width: 'min(18rem, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto', zIndex: 1600 }}
                className={`rounded-2xl border p-2 shadow-2xl ${light ? 'theme-force-light border-[color:var(--color-border)] bg-[color:var(--color-elevated)]' : 'theme-force-dark border-[color:var(--color-border)] bg-[var(--color-surface)]'}`}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && event.relatedTarget !== triggerRef.current) setExpanded(false);
                }}
                onKeyDown={event => {
                    if (event.key === 'Escape' || event.key === 'ArrowRight') {
                        event.preventDefault();
                        event.stopPropagation();
                        close();
                    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                        event.preventDefault();
                        const choices = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
                        const current = choices.indexOf(document.activeElement as HTMLButtonElement);
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
                            : (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
                        choices[next]?.focus();
                    }
                }}
            >
                <button type="button" role="menuitem" onClick={close} className={buttonClass} aria-label={label}>
                    <span className="flex-1 font-semibold">{label}</span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
                {options.map(option => {
                    const OptionIcon = option.icon;
                    const active = option.value === value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => { onChange(option.value); close(); }}
                            className={`${buttonClass} ${active ? light ? 'bg-[var(--color-inset)] text-[var(--color-accent)]' : 'bg-[color:var(--color-ink)]/[0.07] text-[color:var(--color-text)]' : ''}`}
                        >
                            {OptionIcon && <OptionIcon className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />}
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{option.label}</span>
                                {option.note && <span className={`block text-[10px] ${light ? 'text-[color:var(--color-muted)]' : 'text-[var(--color-secondary)]'}`}>{option.note}</span>}
                            </span>
                            {active && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />}
                        </button>
                    );
                })}
            </div>, document.body)}
        </div>
    );
}
