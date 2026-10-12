import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../Crest';
import { counterpartProps, useMapCounterpart } from './selection';
import { DetailsButton } from './ResultRow';
import { keptLines, useResultPress } from './useResultPress';
import './result-row.css';
import './result-tile.css';

/**
 * A person as a football card, several to a line: what kind of football person they are in the corner (a position, a
 * licence, a service, a referee's level) and their club's crest opposite, their face, then as LinkedIn says it their
 * name, what they do, their club and how far, what they are open to, and at the foot one number (a price) and one
 * action. No ratings, numbers or statistics: everything on it is what the person or their club published. Their name
 * goes to their profile; a press anywhere else on the card, or its details button, shows them beside the list, as a
 * row does.
 */
export function ResultTile({ lead, title, to, peek, label, corner, crest, lines, aside, action, tone = 'accent' }: {
    lead: ReactNode; title: string; /** Their full page. */ to: string; /** What it opens (`person-12`). */ peek?: string; label?: string;
    /** The mark in the corner. */ corner?: ReactNode; /** Their club's crest, opposite the corner. */ crest?: { src?: string | null; name: string };
    lines: ReactNode[]; aside?: ReactNode; action?: ReactNode;
    /** The colour of the kind of people listed (one per list). */ tone?: 'accent' | 'info' | 'violet' | 'warning';
}) {
    const linked = counterpartProps(useMapCounterpart());
    const { press, shown } = useResultPress(peek);
    const kept = keptLines(lines);
    return (
        <li>
            <article className="gk-tile" data-tone={tone} data-open={shown || undefined} data-clickable={peek ? true : undefined} onClick={press} {...linked}>
                {corner && <span className="gk-tile__corner">{corner}</span>}
                {crest && <span className="gk-tile__crest" title={crest.name}><Crest src={crest.src} name={crest.name} size={22} /></span>}
                <span className="gk-tile__face">{lead}</span>
                <Link className="gk-tile__name" to={to} aria-label={label} title={title}>{title}</Link>
                <div className="gk-tile__lines">
                    {kept.map((line, index) => <div key={index} className="gk-tile__line" data-line={index}>{typeof line === 'string' ? <span title={line}>{line}</span> : line}</div>)}
                </div>
                {(aside || action || peek) && <div className="gk-tile__foot">
                    {aside && <span className="gk-tile__aside">{aside}</span>}{action}
                    {peek && <DetailsButton peek={peek} name={title} />}
                </div>}
            </article>
        </li>
    );
}
