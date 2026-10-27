import './choice-tiles.css';
import { useId, type ReactNode } from 'react';
import { Heart } from 'lucide-react';

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
 * a phone). `mark="heart"` shows a heart instead of the check, for following. Used by the welcome.
 */
export function ChoiceTiles({ items, chosen, onToggle, label, single = false, compact = false, mark = 'check' }: {
    items: ChoiceTile[]; chosen: readonly string[]; onToggle: (id: string) => void; label: string; single?: boolean; compact?: boolean; mark?: 'check' | 'heart';
}) {
    const base = useId();
    return <div className={`gk-tiles${compact ? ' gk-tiles--compact' : ''}${mark === 'heart' ? ' gk-tiles--heart' : ''}`} role={single ? 'radiogroup' : 'group'} aria-label={label}>
        {items.map(item => {
            const checked = chosen.includes(item.id);
            const hint = item.hint ? `${base}-${item.id}` : undefined;
            return <label key={item.id} className="gk-tile" data-checked={checked || undefined}>
                <input type={single ? 'radio' : 'checkbox'} name={single ? base : undefined} checked={checked} onChange={() => onToggle(item.id)} aria-describedby={hint} />
                {mark === 'heart' && <Heart className="gk-tile__heart" aria-hidden="true" />}
                {item.icon}
                <span className="gk-tile__text"><strong>{item.label}</strong>{item.hint && <small id={hint}>{item.hint}</small>}</span>
            </label>;
        })}
    </div>;
}

export interface ActionTile extends ChoiceTile {
    /** The tile's own small action, such as a Follow button; the rest of the tile does nothing. */
    action?: ReactNode;
    /** A longer explanation: shown on hover or focus where there is a mouse, as the grey line where there is not. */
    more?: ReactNode;
}

/**
 * Tiles that act instead of being picked: each is a button (`onPick`), or carries its own small action. Same look as
 * ChoiceTiles, without a check.
 */
export function ActionTiles({ items, label, onPick }: { items: ActionTile[]; label: string; onPick?: (id: string) => void }) {
    const base = useId();
    return <ul className="gk-tiles gk-tiles--compact gk-tiles--act" aria-label={label}>
        {items.map(item => {
            const id = `${base}-${item.id}`;
            const more = item.more ? `${id}-more` : undefined;
            const body = <>
                {item.icon}
                <span className="gk-tile__text"><strong id={`${id}-name`}>{item.label}</strong>{item.hint && <small id={`${id}-hint`}>{item.hint}</small>}{item.more && <small id={more} className="gk-tile__more" role="tooltip">{item.more}</small>}</span>
                {item.action}
            </>;
            // The button's name is its label and grey line; the explanation is its description, not part of the name.
            return <li key={item.id}>{onPick
                ? <button type="button" className="gk-tile gk-tile--pick" aria-labelledby={`${id}-name${item.hint ? ` ${id}-hint` : ''}`} aria-describedby={more} onClick={() => onPick(item.id)}>{body}</button>
                : <div className="gk-tile gk-tile--action">{body}</div>}</li>;
        })}
    </ul>;
}
