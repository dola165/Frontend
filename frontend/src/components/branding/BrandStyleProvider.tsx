import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { BRAND_STYLE_KEY, BrandStyleContext, isBrandStyle, readBrandStyle, type BrandStyle } from './BrandStyleContext';
import './g-branding.css';
import './pitch-sections.css';

/** Brand artwork and colour appearance are independent browser preferences. */
export function BrandStyleProvider({ children }: { children: ReactNode }) {
    const [style, updateStyle] = useState(readBrandStyle);
    const setStyle = useCallback((next: BrandStyle) => {
        if (!isBrandStyle(next)) return;
        updateStyle(next);
        try { localStorage.setItem(BRAND_STYLE_KEY, next); } catch { /* Still works for this visit. */ }
    }, []);
    useLayoutEffect(() => {
        document.documentElement.dataset.brandStyle = style;
        return () => { delete document.documentElement.dataset.brandStyle; };
    }, [style]);
    useEffect(() => {
        const sync = (event: StorageEvent) => { if (event.key === BRAND_STYLE_KEY || event.key === null) updateStyle(readBrandStyle()); };
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);
    const value = useMemo(() => ({ style, setStyle }), [style, setStyle]);
    return <BrandStyleContext.Provider value={value}>{children}</BrandStyleContext.Provider>;
}
