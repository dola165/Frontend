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

const MODES: Array<{ id: MapMode; labelKey: 'flat' | 'globe' | 'tilted'; icon: typeof Circle }> = [
    { id: 'flat', labelKey: 'flat', icon: MapIcon },
    { id: 'globe', labelKey: 'globe', icon: Globe2 },
    { id: 'tilted', labelKey: 'tilted', icon: Circle }
];

/**
 * Map v2 mode switcher (WEB_APP_MASTER_PLAN.md §3.2): FLAT is the default —
 * the fastest, cleanest option. GLOBE and TILTED are opt-in heavy modes with a
 * one-time warning; the choice persists and the default is always FLAT.
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
            <div className="absolute bottom-3 left-3 z-10 flex gap-1 rounded-xl border border-[#26282d] bg-[#0f1117]/90 p-1 backdrop-blur">
                {MODES.map(({ id, labelKey, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        title={id === 'tilted' && !tiltedAvailable ? t('map.modes.needsKey') : undefined}
                        disabled={id === 'tilted' && !tiltedAvailable}
                        onClick={() => onRequestMode(id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            mode === id
                                ? 'bg-[#16a34a] text-white'
                                : 'text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#f4f4f5]'
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {t(`map.modes.${labelKey}`)}
                    </button>
                ))}
            </div>

            {pendingMode && (
                <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/60 p-4" onClick={onCancelWarning}>
                    <div
                        className="w-full max-w-sm rounded-xl border border-[#26282d] bg-[#0f1117] p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-semibold text-[#f4f4f5]">{t('map.modes.heavyTitle')}</h2>
                        <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">
                            {pendingMode === 'globe'
                                ? t('map.modes.globeWarning')
                                : t('map.modes.tiltedWarning')}
                        </p>
                        <label className="mt-4 flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
                            <input
                                type="checkbox"
                                checked={dontShow}
                                onChange={(e) => setDontShow(e.target.checked)}
                                className="accent-[#16a34a]"
                            />
                            {t('map.modes.dontShowAgain')}
                        </label>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onCancelWarning}
                                className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-2 text-sm font-medium text-[#f4f4f5] hover:bg-[#1a1c22]"
                            >
                                {t('map.modes.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (dontShow) onDismissWarning(true);
                                    onConfirmMode();
                                }}
                                className="rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#22c55e]"
                            >
                                {t('map.modes.switchTo', { mode: pendingMode === 'globe' ? t('map.modes.globe') : t('map.modes.tilted') })}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
