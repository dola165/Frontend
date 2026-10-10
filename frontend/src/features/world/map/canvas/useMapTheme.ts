import { useEffect, useState, useSyncExternalStore } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import { getHeritageStyle } from '../../../../components/map/heritageStyle';
import { MAP_STYLE_DEFAULT } from '../../../../components/map/mapLayers';

const subscribe = (notify: () => void) => {
    const observer = new MutationObserver(notify);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
};
const readTheme = () => document.documentElement.classList.contains('dark') ? 'dark' as const : 'light' as const;

/** The app's current appearance; the map follows it like every other World page. */
export const useAppTheme = () => useSyncExternalStore(subscribe, readTheme, () => 'dark' as const);

/**
 * The basemap for the current theme. While the recoloured style loads the canvas waits;
 * if it cannot load, the plain basemap URL is used so the map still works.
 */
export function useBasemapStyle(theme: 'light' | 'dark') {
    const [state, setState] = useState<{ theme: string; style: StyleSpecification | string }>();
    useEffect(() => {
        let active = true;
        getHeritageStyle(theme)
            .then(style => { if (active) setState({ theme, style }); })
            .catch(() => { if (active) setState({ theme, style: MAP_STYLE_DEFAULT }); });
        return () => { active = false; };
    }, [theme]);
    return state?.theme === theme ? state.style : null;
}

export type PlacePalette = Record<'club' | 'venue' | 'match' | 'trial' | 'competition' | 'surface' | 'text' | 'muted' | 'line' | 'accent' | 'route', string>;

/** Map paint uses the design tokens of the surrounding page, read once per theme. */
export function usePalette(theme: 'light' | 'dark'): PlacePalette | null {
    const [palette, setPalette] = useState<{ theme: string; value: PlacePalette }>();
    useEffect(() => {
        // Read after the theme class has been applied to the document.
        const frame = requestAnimationFrame(() => {
            const probe = document.createElement('div');
            probe.className = 'gk';
            probe.hidden = true;
            document.body.appendChild(probe);
            const css = getComputedStyle(probe);
            const token = (name: string) => css.getPropertyValue(`--gk-${name}`).trim();
            setPalette({ theme, value: {
                club: token('accent'), venue: token('info'), match: token('violet'), trial: token('warning'), competition: token('danger'),
                surface: token('surface'), text: token('text'), muted: token('text-3'), line: token('line-strong'), accent: token('accent'), route: token('accent'),
            } });
            probe.remove();
        });
        return () => cancelAnimationFrame(frame);
    }, [theme]);
    return palette?.theme === theme ? palette.value : null;
}

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
