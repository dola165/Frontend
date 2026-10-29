/** How far a project is, as a thin bar; the number is for screen readers and the tooltip. */
export function ProgressBar({ value, label, wide = false }: { value: number; label: string; wide?: boolean }) {
    const share = Math.max(0, Math.min(100, value));
    return <span className="pj-bar" data-wide={wide || undefined} role="img" aria-label={label} title={label}><span className="pj-bar__fill" style={{ width: `${share}%` }} /></span>;
}
