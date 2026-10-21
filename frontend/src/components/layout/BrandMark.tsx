/** Supplied identity: three app tiles and a ball; World spreads the tiles into an orbit. */
export function BrandMark({ world = false, className = '' }: { world?: boolean; className?: string }) {
    return <svg className={className} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
        {world ? <><g fill="var(--color-accent)">{[[64, 17], [111, 64], [64, 111], [17, 64]].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 15} y={y - 15} width="30" height="30" rx="9" transform={`rotate(45 ${x} ${y})`} />)}</g><circle cx="64" cy="64" r="19" fill="var(--color-text)" /></>
            : <><g fill="var(--color-accent)"><rect x="8" y="8" width="50" height="50" rx="15" /><rect x="8" y="70" width="50" height="50" rx="15" /><rect x="70" y="70" width="50" height="50" rx="15" /></g><circle cx="96" cy="33" r="28" fill="var(--color-text)" /></>}
    </svg>;
}
