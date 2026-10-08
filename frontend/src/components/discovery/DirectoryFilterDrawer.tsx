import { useId, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

interface DirectoryFilterDrawerProps {
    open: boolean;
    title: string;
    closeLabel: string;
    closeRef?: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    children: ReactNode;
}

export const DirectoryFilterDrawer = ({
    open,
    title,
    closeLabel,
    closeRef,
    onClose,
    children
}: DirectoryFilterDrawerProps) => {
    const titleId = useId();
    if (!open) return null;

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== 'Tab') return;

        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]'))
            .filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <div className="fixed inset-0 z-[1800] xl:hidden" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeyDown}>
            <button type="button" tabIndex={-1} aria-label={closeLabel} onClick={onClose} className="absolute inset-0 bg-[color:var(--color-overlay)]/70 backdrop-blur-sm" />
            <section className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-[color:var(--theme-border)] bg-[color:var(--theme-page)] shadow-2xl">
                <header className="flex items-center justify-between border-b border-[color:var(--theme-border)] px-5 py-4">
                    <h2 id={titleId} className="text-base font-semibold text-[color:var(--text-primary)]">{title}</h2>
                    <button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--theme-border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--theme-surface-inset)] hover:text-[color:var(--text-primary)]">
                        <X className="h-5 w-5" />
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
            </section>
        </div>
    );
};
