import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { ResultRow } from './ResultRow';
import './result-row.css';

/**
 * One side of a match in a row. `mine` stars the viewer's own team; `muted` is a side still to be found; `ghost` one
 * the viewer could fill (their crest, faint, in a dashed ring: "Your U14 Boys?").
 */
export interface MatchSide { name: string; logo?: string | null; score?: number | null; mine?: boolean; muted?: boolean; ghost?: boolean }

/** The two crests where a club's crest would be, the away one over the home one's corner; an empty dashed ring for a side still to be found. */
export function CrestPair({ home, away }: { home: MatchSide; away: MatchSide }) {
    const crest = (side: MatchSide) => side.ghost ? <span className="gk-result-pair__ghost"><Crest src={side.logo} name={side.name} size={20} round /></span>
        : side.muted && !side.logo ? <span className="gk-result-pair__empty" /> : <Crest src={side.logo} name={side.name} size={26} round />;
    return <span className="gk-result-pair" aria-hidden="true">{crest(home)}{crest(away)}</span>;
}

/** The score once it counts: the winner's goals bright. */
export function Score({ home, away }: { home: number; away: number }) {
    return <span className="gk-result-score" role="img" aria-label={`${home}–${away}`}><b data-win={home > away || undefined}>{home}</b>–<b data-win={away > home || undefined}>{away}</b></span>;
}

/**
 * A match as one row of a list, the way every World list reads (the clubs list's row): the two crests, "Home v Away"
 * as the link (my team starred), when and where under it, and at the end the score once it counts, else what the
 * match waits for or its state. A press shows the match beside the list.
 */
export function MatchRow({ to, peek, home, away, lines, aside, action, title }: {
    to: string; peek?: string; home: MatchSide; away: MatchSide; lines: ReactNode[]; aside?: ReactNode; action?: ReactNode;
    /** The link's name when the two names say too little (the competition, the ground). */ title?: string;
}) {
    const t = useWorldCopy();
    const scored = home.score != null && away.score != null;
    return (
        <ResultRow lead={<CrestPair home={home} away={away} />} title={`${home.name} ${t('v')} ${away.name}`} to={to} peek={peek} label={title}
            mark={home.mine || away.mine ? <Star className="gk-result__star" role="img" aria-label={t('Your team')} /> : undefined}
            lines={lines} aside={scored ? <Score home={home.score!} away={away.score!} /> : aside} action={action} />
    );
}
