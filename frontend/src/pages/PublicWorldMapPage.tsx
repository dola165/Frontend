import { useState } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapExperience } from '../components/map/MapExperience';

type PublicMapTheme = 'light' | 'dark';

/**
 * Full-screen, signed-out entry point for GrassKickZ World. It deliberately
 * omits product navigation while keeping the same public-only map contract as
 * the landing page. The local appearance toggle changes the map surface only;
 * it never changes the app-wide theme preference.
 */
export const PublicWorldMapPage = () => {
    const navigate = useNavigate();
    const [mapTheme, setMapTheme] = useState<PublicMapTheme>('light');

    return (
        <div className="relative h-full min-h-0 w-full">
            <MapExperience
                darkMode={false}
                context="guest"
                mapTheme={mapTheme}
            />

            <div className="pointer-events-none absolute right-4 top-4 z-[1300] flex flex-col items-end gap-2">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    aria-label="Return to landing page"
                    className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-700 px-5 py-3 text-base font-black text-white shadow-xl transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-white"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Return
                </button>
                <button
                    type="button"
                    onClick={() => setMapTheme((current) => current === 'light' ? 'dark' : 'light')}
                    aria-label={`Switch to ${mapTheme === 'light' ? 'dark' : 'light'} map`}
                    aria-pressed={mapTheme === 'dark'}
                    className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg backdrop-blur-md transition-colors hover:border-emerald-700 hover:text-emerald-700 dark:border-white/10 dark:bg-[#0d1016]/95 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-300"
                >
                    {mapTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {mapTheme === 'light' ? 'Dark map' : 'Light map'}
                </button>
            </div>
        </div>
    );
};
