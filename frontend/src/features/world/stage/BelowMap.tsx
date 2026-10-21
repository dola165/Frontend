import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import './below-map.css';

/**
 * Where a World page hands over from the map to what is under it: the list's (or section's) name and symbol, a quiet
 * hint (its count), and its options at the end (the sort; more lists and views later), over a line. Every page
 * that shows something under the map starts it with this, so the map and the page never run into each other.
 */
export function BelowMapHead({ icon: Icon, title, hint, nav, children }: { icon?: LucideIcon; title: string; hint?: ReactNode; /** Beside the title (the day before and after). */ nav?: ReactNode; children?: ReactNode }) {
    return (
        <header className="gk-world-below">
            <div className="gk-world-below__title">
                {Icon && <span className="gk-world-below__icon" aria-hidden="true"><Icon /></span>}
                <h2>{title}</h2>
                {nav}
                {hint && <span className="gk-world-below__hint">{hint}</span>}
            </div>
            {children && <div className="gk-world-below__tools">{children}</div>}
        </header>
    );
}
