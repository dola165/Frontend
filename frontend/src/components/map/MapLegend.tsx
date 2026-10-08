const LEGEND_LABELS: Record<string, string> = {
    STADIUM: 'Stadium',
    CLUB: 'Club',
    TRYOUT: 'Tryout',
    MATCH: 'Match',
    TOURNAMENT: 'Tournament'
};

/**
 * Bottom-center map legend: a football + label per marker type the
 * viewer is allowed to see. Purely decorative (pointer-events: none).
 */
export const MapLegend = ({ types }: { types: string[] }) => {
    const uniqueTypes = Array.from(new Set(types));

    if (uniqueTypes.length === 0) {
        return null;
    }

    return (
        <div className="atlas-map-legend">
            {uniqueTypes.map((type) => (
                <span key={type} className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
                    <span aria-hidden="true">⚽</span>
                    {LEGEND_LABELS[type] ?? type}
                </span>
            ))}
        </div>
    );
};
