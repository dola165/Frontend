import { useEffect, useRef, type RefObject } from 'react';

type FocusableElement = HTMLElement & { disabled?: boolean };

/** Keeps keyboard focus inside the first control of a lightweight workspace dialog. */
export function useDialogFocus(
    open: boolean,
    dialogRef: RefObject<HTMLElement | null>,
    onEscape?: () => void,
    initialFocusRef?: RefObject<HTMLElement | null>,
) {
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const onEscapeRef = useRef(onEscape);
    useEffect(() => {
        onEscapeRef.current = onEscape;
    }, [onEscape]);

    useEffect(() => {
        if (!open) return undefined;

        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const focusTimer = window.setTimeout(() => {
            if (initialFocusRef?.current) {
                initialFocusRef.current.focus();
                return;
            }
            const firstFocusable = dialogRef.current?.querySelector<FocusableElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            firstFocusable?.focus();
        }, 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onEscapeRef.current?.();
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            previousFocusRef.current?.focus();
            previousFocusRef.current = null;
        };
    }, [dialogRef, initialFocusRef, open]);
}
