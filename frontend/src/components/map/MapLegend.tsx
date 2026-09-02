const LEGEND_LABELS: Record<string, string> = {
    CLUB: 'Club',
    TRYOUT: 'Tryout',
    MATCH: 'Match',
    TOURNAMENT: 'Tournament'
};

/**
 * Bottom-center map legend: one colored dot + label per marker type the
 * viewer is allowed to see. Purely decorative (pointer-events: none).
 */
export const MapLegend = ({ types }: { types: string[] }) => {
    const uniqueTypes = Array.from(new Set(types));

    if (uniqueTypes.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[600] hidden -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#0d1016]/95 dark:shadow-none sm:flex">
            {uniqueTypes.map((type) => (
                <span key={type} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <img src="/map-pins/football-location-pin.png" alt="" className="h-4 w-4 object-contain" />
                    {LEGEND_LABELS[type] ?? type}
                </span>
            ))}
        </div>
    );
};
