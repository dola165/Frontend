import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Globe2, Map as MapIcon } from 'lucide-react';
import type { MapMode } from '../../pages/MapPage';

interface MapModeControlProps {
    mode: MapMode;
    /** TILTED needs a MapTiler API key — disabled with a hint when missing. */
    tiltedAvailable: boolean;
    pendingMode: MapMode | null;
    onRequestMode: (mode: MapMode) => void;
    onConfirmMode: () => void;
    onDismissWarning: (dismissed: boolean) => void;
    onCancelWarning: () => void;
}

/** FLAT renders positron in both themes (canvas gets a CSS dusk filter in dark mode); GLOBE and TILTED are the opt-in heavy modes. */
const MODES: Array<{ id: MapMode; label: string; icon: typeof Circle }> = [
    { id: 'flat', label: 'Map', icon: MapIcon },
    { id: 'globe', label: 'Globe', icon: Globe2 },
    { id: 'tilted', label: 'Tilted', icon: Circle }
];

/**
 * Map v2 mode switcher (WEB_APP_MASTER_PLAN.md §3.2): FLAT is the default —
 * the fastest, cleanest option (now rendered in the dark style). GLOBE and
 * TILTED are opt-in heavy modes with a one-time warning; the choice persists
 * and the default is always FLAT.
 */
export const MapModeControl = ({
    mode,
    tiltedAvailable,
    pendingMode,
    onRequestMode,
    onConfirmMode,
    onDismissWarning,
    onCancelWarning
}: MapModeControlProps) => {
    const { t } = useTranslation();
    const [dontShow, setDontShow] = useState(false);

    return (
        <>
            {/* Positioning (bottom-left, shifted right of the open drawer) is owned
                by the wrapper in MapPage — this component only paints the pill. */}
            <div className="map-mode-toggle">
                {MODES.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        title={id === 'tilted' && !tiltedAvailable ? t('map.modes.needsKey') : undefined}
                        disabled={id === 'tilted' && !tiltedAvailable}
                        onClick={() => onRequestMode(id)}
                        className={`map-mode-button disabled:cursor-not-allowed disabled:opacity-40 ${
                            mode === id ? 'map-mode-button--active' : ''
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {pendingMode && (
                <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60" onClick={onCancelWarning}>
                    <div
                        className="w-full max-w-sm rounded-[18px] border border-slate-200 bg-white/95 p-6 shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-white/10 dark:bg-[#0d1016]/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('map.modes.heavyTitle')}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {pendingMode === 'globe'
                                ? t('map.modes.globeWarning')
                                : t('map.modes.tiltedWarning')}
                        </p>
                        <label className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <input
                                type="checkbox"
                                checked={dontShow}
                                onChange={(e) => setDontShow(e.target.checked)}
                                className="accent-emerald-700"
                            />
                            {t('map.modes.dontShowAgain')}
                        </label>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onCancelWarning}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                            >
                                {t('map.modes.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (dontShow) onDismissWarning(true);
                                    onConfirmMode();
                                }}
                                className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                            >
                                {t('map.modes.switchTo', { mode: pendingMode === 'globe' ? 'Globe' : 'Tilted' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
