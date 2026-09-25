import { useEffect, useState } from 'react';

export function panelBounds(viewport: number) {
    return { min: 340, max: Math.max(340, Math.min(900, viewport - 480)) };
}
export function useDolaPanelSize(accountId?: number) {
    const key = `gk-dola-width:${accountId ?? 'guest'}`;
    const [viewport, setViewport] = useState(window.innerWidth);
    const [preferred, setPreferred] = useState<number | null>(() => {
        try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) && value >= 340 && value <= 900 ? value : null; }
        catch { return null; }
    });
    useEffect(() => {
        const resize = () => setViewport(window.innerWidth);
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            try { if (preferred === null) localStorage.removeItem(key); else localStorage.setItem(key, String(preferred)); } catch { /* Storage is optional. */ }
        }, 150);
        return () => window.clearTimeout(timer);
    }, [preferred, key]);
    const { min, max } = panelBounds(viewport);
    const width = Math.round(Math.max(min, Math.min(max, preferred ?? Math.min(420, viewport * .27))));
    const available = viewport - width;
    return { width, min, max, resizable: viewport >= 1000,
        layout: available >= 1250 ? 'wide' : available >= 1000 ? 'both' : available >= 780 ? 'right' : 'compact',
        setWidth: (value: number) => setPreferred(Math.max(min, Math.min(max, value))),
        reset: () => setPreferred(null) };
}
