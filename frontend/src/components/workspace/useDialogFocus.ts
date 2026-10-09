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

const dialogStack: Array<{ token: symbol; returnFocus: HTMLElement | null }> = [];
let scrollLockCount = 0;
let previousBodyOverflow = '';
const backgroundLocks = new WeakMap<HTMLElement, { count: number; inert: boolean; ariaHidden: string | null }>();

const focusableElements = (dialog: HTMLElement | null) => dialog
    ? Array.from(dialog.querySelectorAll<FocusableElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hidden && !element.closest('[hidden], [inert]') && element.getAttribute('aria-hidden') !== 'true')
    : [];

const suppressBackground = (dialog: HTMLElement) => {
    const suppressed: HTMLElement[] = [];
    let activeBranch: HTMLElement = dialog;
    let parent = activeBranch.parentElement;

    while (parent) {
        for (const sibling of Array.from(parent.children)) {
            if (sibling === activeBranch || !(sibling instanceof HTMLElement)) continue;
            const lock = backgroundLocks.get(sibling) ?? { count: 0, inert: sibling.inert, ariaHidden: sibling.getAttribute('aria-hidden') };
            lock.count += 1;
            backgroundLocks.set(sibling, lock);
            suppressed.push(sibling);
            sibling.inert = true;
            sibling.setAttribute('aria-hidden', 'true');
        }
        if (parent === document.body) break;
        activeBranch = parent;
        parent = parent.parentElement;
    }

    return () => {
        for (const element of suppressed) {
            const lock = backgroundLocks.get(element);
            if (!lock || --lock.count > 0) continue;
            element.inert = lock.inert;
            if (lock.ariaHidden === null) element.removeAttribute('aria-hidden');
            else element.setAttribute('aria-hidden', lock.ariaHidden);
            backgroundLocks.delete(element);
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
    const onEscapeRef = useRef(onEscape);
    useEffect(() => {
        onEscapeRef.current = onEscape;
    }, [onEscape]);

    useEffect(() => {
        if (!open) return undefined;

        const returnFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const token = Symbol('dialog');
        const entry = { token, returnFocus };
        dialogStack.push(entry);
        const dialog = dialogRef.current;
        const restoreBackground = dialog ? suppressBackground(dialog) : () => undefined;
        const previousTabIndex = dialog?.getAttribute('tabindex') ?? null;
        if (dialog && !dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
        if (scrollLockCount === 0) {
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        scrollLockCount += 1;

        const isTopDialog = () => dialogStack.at(-1)?.token === token;
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
            const wasTop = isTopDialog();
            const stackIndex = dialogStack.findIndex(item => item.token === token);
            if (stackIndex >= 0) {
                const next = dialogStack[stackIndex + 1];
                // A child may close after its parent. Carry the original trigger
                // forward until the remaining background locks have been released.
                if (next && (!next.returnFocus?.isConnected || dialog?.contains(next.returnFocus))) next.returnFocus = entry.returnFocus;
                dialogStack.splice(stackIndex, 1);
            }
            restoreBackground();
            if (dialog) {
                if (previousTabIndex === null) dialog.removeAttribute('tabindex');
                else dialog.setAttribute('tabindex', previousTabIndex);
            }
            scrollLockCount = Math.max(0, scrollLockCount - 1);
            if (scrollLockCount === 0) document.body.style.overflow = previousBodyOverflow;
            if (wasTop && entry.returnFocus?.isConnected) entry.returnFocus.focus({ preventScroll: true });
        };
    }, [dialogRef, initialFocusRef, open]);
}
