import { useEffect, type RefObject } from 'react';

/** Inline mobile filters: Escape closes and returns focus; these are not modal dialogs. */
export const useFilterDisclosure = (open: boolean, close: () => void, trigger: RefObject<HTMLButtonElement | null>) => {
    useEffect(() => {
        if (!open) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            close();
            trigger.current?.focus();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [open, close, trigger]);
};
