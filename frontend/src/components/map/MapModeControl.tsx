import { useState } from 'react';
import { isAndroidApp } from '../../android/bridge';
import { useTranslation } from 'react-i18next';
import { Circle, Globe2, Map as MapIcon } from 'lucide-react';
import type { MapMode } from './MapExperience';

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
                by the route wrapper — this component only paints the pill. */}
            <div className="map-mode-toggle">
                {MODES.filter(({ id }) => !(isAndroidApp && id === 'tilted' && !tiltedAvailable)).map(({ id, label, icon: Icon }) => (
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
                <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-[color:var(--color-overlay)]/50 p-4 dark:bg-[color:var(--color-overlay)]/60" onClick={onCancelWarning}>
                    <div
                        className="w-full max-w-sm rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-elevated)]/95 p-6 shadow-[0_8px_32px_color-mix(in_srgb,_var(--color-shadow)_12%,_transparent)] backdrop-blur-md dark:border-[color:var(--color-border)]/10 dark:bg-[var(--color-overlay)]/95 dark:shadow-[0_8px_32px_color-mix(in_srgb,_var(--color-shadow)_45%,_transparent)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-semibold text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{t('map.modes.heavyTitle')}</h2>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
                            {pendingMode === 'globe'
                                ? t('map.modes.globeWarning')
                                : t('map.modes.tiltedWarning')}
                        </p>
                        <label className="mt-4 flex items-center gap-2 text-xs font-medium text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
                            <input
                                type="checkbox"
                                checked={dontShow}
                                onChange={(e) => setDontShow(e.target.checked)}
                                className="accent-[var(--color-accent)]"
                            />
                            {t('map.modes.dontShowAgain')}
                        </label>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onCancelWarning}
                                className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-elevated)] px-4 py-2 text-sm font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-inset)] dark:border-[color:var(--color-border)]/10 dark:bg-[color:var(--color-ink)]/5 dark:text-[color:var(--color-text)] dark:hover:bg-[color:var(--color-ink)]/10"
                            >
                                {t('map.modes.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (dontShow) onDismissWarning(true);
                                    onConfirmMode();
                                }}
                                className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--color-on-accent)] hover:bg-[color:var(--color-accent)]"
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
