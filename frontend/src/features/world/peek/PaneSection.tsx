import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './pane.css';

/** Where a part's "View …" leads: to its own tab in the pane (`select`), or to its tab of the full page (`to`). */
export type PaneMore = { label: string; to: string } | { label: string; select: () => void };

/** One part of a thing in the pane (a club's teams, a person's career): its name and how many, some of it, and the way to all of it. */
export function PaneSection({ title, count, more, children }: { title: string; count?: number; more?: PaneMore; children: ReactNode }) {
    return (
        <section className="gk-pane-section">
            <header>
                <h3 className="gk-peek-section__title">{title}{count != null && <span className="gk-faint"> · {count}</span>}</h3>
                {more && ('to' in more
                    ? <Link className="gk-pane-more" to={more.to}>{more.label}<ChevronRight aria-hidden="true" /></Link>
                    : <button type="button" className="gk-pane-more" onClick={more.select}>{more.label}<ChevronRight aria-hidden="true" /></button>)}
            </header>
            {children}
        </section>
    );
}
