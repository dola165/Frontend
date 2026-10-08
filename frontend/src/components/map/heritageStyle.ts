import type { StyleSpecification } from 'maplibre-gl';
import { prefersLightMapRendering } from './mapPerformance';
import { MAP_STYLE_DEFAULT, withDarkPaints, withHeritagePaints } from './mapLayers';

// Cache the recolored style across remounts; retry on a later mount after failure.
const stylePromises: Partial<Record<string, Promise<StyleSpecification>>> = {};
export const getHeritageStyle = (theme: 'light' | 'dark' = 'light', { includeTerrain = !prefersLightMapRendering() } = {}): Promise<StyleSpecification> => {
    const key = `${theme}:${includeTerrain}`;
    if (!stylePromises[key]) {
        stylePromises[key] = fetch(MAP_STYLE_DEFAULT)
            .then((response) => {
                if (!response.ok) throw new Error(`positron fetch failed: ${response.status}`);
                return response.json() as Promise<Record<string, unknown>>;
            })
            .then((style) => (theme === 'dark' ? withDarkPaints(style) : withHeritagePaints(style, { includeTerrain })) as StyleSpecification)
            .catch((styleError: unknown) => {
                delete stylePromises[key]; // allow a fresh attempt on the next mount
                throw styleError;
            });
    }
    return stylePromises[key]!;
};

