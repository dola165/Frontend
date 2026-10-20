import './choice-tiles.css';
import { useId, type ReactNode } from 'react';

export interface ChoiceTile {
    id: string;
    label: ReactNode;
    /** One short grey line under the label. */
    hint?: ReactNode;
    /** A role mark, a crest or a small icon, at the tile's start. */
    icon?: ReactNode;
}

/**
 * Tiles to pick from: icon, label, one grey line, the check in the corner, and a soft tint when picked. Several at once
 * by default; `single` makes it one choice. `compact` is the tighter grid of a guided flow (three or four across, two on
 * a phone). Used by Roles and work and by "Set up your profile".
 */
export function ChoiceTiles({ items, chosen, onToggle, label, single = false, compact = false }: {
    items: ChoiceTile[]; chosen: readonly string[]; onToggle: (id: string) => void; label: string; single?: boolean; compact?: boolean;
}) {
    const base = useId();
    return <div className={`gk-tiles${compact ? ' gk-tiles--compact' : ''}`} role={single ? 'radiogroup' : 'group'} aria-label={label}>
        {items.map(item => {
            const checked = chosen.includes(item.id);
            const hint = item.hint ? `${base}-${item.id}` : undefined;
            return <label key={item.id} className="gk-tile" data-checked={checked || undefined}>
                <input type={single ? 'radio' : 'checkbox'} name={single ? base : undefined} checked={checked} onChange={() => onToggle(item.id)} aria-describedby={hint} />
                {item.icon}
                <span className="gk-tile__text"><strong>{item.label}</strong>{item.hint && <small id={hint}>{item.hint}</small>}</span>
            </label>;
        })}
    </div>;
}
