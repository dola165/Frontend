import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './embedded-map-filters.css';

/** A full-size editing surface for maps whose canvas is embedded in another page. */
export function EmbeddedMapFilterDialog({ children, onClose, darkMode = false }: { children: ReactNode; onClose: () => void; darkMode?: boolean }) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const overflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        return () => { dialog.close(); document.body.style.overflow = overflow; trigger?.focus({ preventScroll: true }); };
    }, []);
    return createPortal(<dialog ref={ref} className={`map-page-shell map-atlas ${darkMode ? 'map-force-dark' : 'map-force-light'} atlas-embedded-filters`} aria-label="Find football clubs" onCancel={event => { event.preventDefault(); onClose(); }}>
        {children}
    </dialog>, document.body);
}
