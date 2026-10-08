import { useEffect, useRef, type RefObject } from 'react';

type FocusableElement = HTMLElement & { disabled?: boolean };

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

const dialogStack: symbol[] = [];
let scrollLockCount = 0;
let previousBodyOverflow = '';

const focusableElements = (dialog: HTMLElement | null) => dialog
    ? Array.from(dialog.querySelectorAll<FocusableElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hidden && !element.closest('[hidden], [inert]') && element.getAttribute('aria-hidden') !== 'true')
    : [];

const suppressBackground = (dialog: HTMLElement) => {
    const restored: Array<{ element: HTMLElement; inert: boolean; ariaHidden: string | null }> = [];
    let activeBranch: HTMLElement = dialog;
    let parent = activeBranch.parentElement;

    while (parent) {
        for (const sibling of Array.from(parent.children)) {
            if (sibling === activeBranch || !(sibling instanceof HTMLElement)) continue;
            restored.push({ element: sibling, inert: sibling.inert, ariaHidden: sibling.getAttribute('aria-hidden') });
            sibling.inert = true;
            sibling.setAttribute('aria-hidden', 'true');
        }
        if (parent === document.body) break;
        activeBranch = parent;
        parent = parent.parentElement;
    }

    return () => {
        for (const { element, inert, ariaHidden } of restored) {
            element.inert = inert;
            if (ariaHidden === null) element.removeAttribute('aria-hidden');
            else element.setAttribute('aria-hidden', ariaHidden);
        }
    };
};

/** Provides entry focus, containment, Escape, background isolation and focus return. */
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
        const token = Symbol('dialog');
        dialogStack.push(token);
        const dialog = dialogRef.current;
        const restoreBackground = dialog ? suppressBackground(dialog) : () => undefined;
        const previousTabIndex = dialog?.getAttribute('tabindex') ?? null;
        if (dialog && !dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
        if (scrollLockCount === 0) {
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        scrollLockCount += 1;

        const isTopDialog = () => dialogStack.at(-1) === token;
        const focusTimer = window.setTimeout(() => {
            if (!isTopDialog()) return;
            if (initialFocusRef?.current) {
                initialFocusRef.current.focus({ preventScroll: true });
                return;
            }
            const firstFocusable = focusableElements(dialogRef.current)[0];
            (firstFocusable ?? dialogRef.current)?.focus({ preventScroll: true });
        }, 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isTopDialog()) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onEscapeRef.current?.();
                return;
            }
            if (event.key !== 'Tab') return;

            const dialogElement = dialogRef.current;
            const focusable = focusableElements(dialogElement);
            if (focusable.length === 0) {
                event.preventDefault();
                dialogElement?.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && (active === first || !dialogElement?.contains(active))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (active === last || !dialogElement?.contains(active))) {
                event.preventDefault();
                first.focus();
            }
        };
        const handleFocusIn = (event: FocusEvent) => {
            if (!isTopDialog() || dialogRef.current?.contains(event.target as Node)) return;
            (focusableElements(dialogRef.current)[0] ?? dialogRef.current)?.focus();
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('focusin', handleFocusIn);

        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('focusin', handleFocusIn);
            const stackIndex = dialogStack.lastIndexOf(token);
            if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
            restoreBackground();
            if (dialog) {
                if (previousTabIndex === null) dialog.removeAttribute('tabindex');
                else dialog.setAttribute('tabindex', previousTabIndex);
            }
            scrollLockCount = Math.max(0, scrollLockCount - 1);
            if (scrollLockCount === 0) document.body.style.overflow = previousBodyOverflow;
            previousFocusRef.current?.focus({ preventScroll: true });
            previousFocusRef.current = null;
        };
    }, [dialogRef, initialFocusRef, open]);
}
