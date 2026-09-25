import type { StyleSpecification } from 'maplibre-gl';
import { isAndroidApp } from '../../android/bridge';
import { MAP_STYLE_DEFAULT, withDarkPaints, withHeritagePaints } from './mapLayers';

// Cache the recolored style across remounts; retry on a later mount after failure.
const stylePromises: Partial<Record<'light' | 'dark', Promise<StyleSpecification>>> = {};
export const getHeritageStyle = (theme: 'light' | 'dark' = 'light'): Promise<StyleSpecification> => {
    if (!stylePromises[theme]) {
        stylePromises[theme] = fetch(MAP_STYLE_DEFAULT)
            .then((response) => {
                if (!response.ok) throw new Error(`positron fetch failed: ${response.status}`);
                return response.json() as Promise<Record<string, unknown>>;
            })
            .then((style) => (theme === 'dark' ? withDarkPaints(style) : withHeritagePaints(style, { includeTerrain: !isAndroidApp })) as StyleSpecification)
            .catch((styleError: unknown) => {
                delete stylePromises[theme]; // allow a fresh attempt on the next mount
                throw styleError;
            });
    }
    return stylePromises[theme]!;
};

