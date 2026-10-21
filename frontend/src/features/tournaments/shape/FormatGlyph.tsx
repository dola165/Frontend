import type { SVGProps } from 'react';
import type { ShapeKind } from './shapeOf';

/** Each format's picture on a 24-unit grid: a table, a bracket, groups into a final, pairs by round, everyone plays everyone, a ladder. */
const DRAWN: Record<ShapeKind, { lines: string; dots?: [number, number][] }> = {
    league: { lines: 'M4 5h16v14H4z M4 9.7h16 M4 14.3h16 M9 5v14' },
    cup: { lines: 'M3 5h5v6H3 M3 13h5v6H3 M8 8h5v8H8 M13 12h8' },
    groups: { lines: 'M3 4h6v6H3z M3 14h6v6H3z M9 7h5v10H9 M14 12h7' },
    swiss: { lines: 'M7 6h10 M7 12h10 M7 18h10', dots: [[5, 6], [19, 6], [5, 12], [19, 12], [5, 18], [19, 18]] },
    festival: { lines: 'M10.4 8.6 7.6 13.4 M13.6 8.6l2.8 4.8 M9 17h6', dots: [[12, 6], [6, 16.5], [18, 16.5]] },
    ladder: { lines: 'M7 3v18 M17 3v18 M7 7.5h10 M7 12h10 M7 16.5h10' },
};

/**
 * A tournament's format as a small picture (decision 11: every tournament drawn as its format). Decorative unless it
 * is given a `title`, which then names it for screen readers.
 */
export function FormatGlyph({ kind, title, ...props }: { kind: ShapeKind; title?: string } & SVGProps<SVGSVGElement>) {
    const { lines, dots = [] } = DRAWN[kind];
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
            role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} {...props}>
            <path d={lines} />
            {dots.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} fill="currentColor" stroke="none" />)}
        </svg>
    );
}

/** The format pictures as symbols for choices (the Format tiles). */
export const LeagueGlyph = (props: SVGProps<SVGSVGElement>) => <FormatGlyph kind="league" {...props} />;
export const CupGlyph = (props: SVGProps<SVGSVGElement>) => <FormatGlyph kind="cup" {...props} />;
export const GroupsGlyph = (props: SVGProps<SVGSVGElement>) => <FormatGlyph kind="groups" {...props} />;
export const FestivalGlyph = (props: SVGProps<SVGSVGElement>) => <FormatGlyph kind="festival" {...props} />;
export const LadderGlyph = (props: SVGProps<SVGSVGElement>) => <FormatGlyph kind="ladder" {...props} />;
