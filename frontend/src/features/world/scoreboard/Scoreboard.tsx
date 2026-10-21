import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { peekClick, usePeek } from '../peek/usePeek';
import type { WhenTone } from './matchState';
import './scoreboard.css';

// Score lines in the familiar scoreboard shape (the time on the left, the two teams stacked with their crests, the
// score on the right): a match inside a drawer (a club's recent matches, a tournament's fixtures) and the Browse area's
// lines. The lists under the map read as rows (`directory/MatchRow`).

/**
 * One side of a match. `mine` stars the viewer's own team, as favourites do on score sites; `ghost` is a side still
 * to be found that the viewer could fill (their crest, faint, in a dashed ring: "Your U14 Boys?").
 */
export interface Side { name: string; logo?: string | null; score?: number | null; muted?: boolean; mine?: boolean; ghost?: boolean }
/** A word in the time column instead of a kick-off time (FT, Canc., On now), translated, with its state for colour. */
export interface LineState { word: string; code: string; tone?: WhenTone; spoken?: string }
/** A row's counterpart on the map: chosen, lit, and lighting its pin while hovered. */
export interface Linked { current?: boolean; highlighted?: boolean; onHover?: (active: boolean) => void }

/**
 * One match: when (or its state), the two sides stacked, the score (or `aside` in its place), and one quiet tag.
 * With `peek`, a plain click opens the match's drawer; the link still goes to the full page in a new tab.
 */
export function MatchLine({ to, peek, open, time, day, state, home, away, tag, title, aside, linked, faint }: {
    to?: string; peek?: string; /** How it opens (beside a club in a pane: stacked over it); else as the list does. */ open?: (value: string, options?: { focus?: boolean }) => void;
    time?: string; day?: string; state?: LineState;
    home: Side; away: Side; tag?: ReactNode; title?: string; aside?: ReactNode; linked?: Linked; /** A result carried over from before GrassKickZ. */ faint?: boolean;
}) {
    const t = useWorldCopy();
    const drawers = usePeek();
    const scored = home.score != null && away.score != null;
    const wins = (side: Side, other: Side) => scored && side.score! > other.score!;
    const team = (side: Side, other: Side) => <span className="gk-sb__team" data-win={wins(side, other) || undefined} data-muted={side.muted || undefined} data-mine={side.mine || undefined} data-ghost={side.ghost || undefined}>
        {side.ghost ? <span className="gk-sb__ghost" aria-hidden="true"><Crest src={side.logo} name={side.name} size={18} round /></span>
            : side.muted && !side.logo ? <span className="gk-sb__nocrest" aria-hidden="true" /> : <Crest src={side.logo} name={side.name} size={18} round />}
        {side.mine && <Star className="gk-sb__mine" role="img" aria-label={t('Your team')} />}<span>{side.name}</span>
    </span>;
    const body = <>
        <span className="gk-sb__when">
            {state ? <b data-state={state.code} data-tone={state.tone} aria-label={state.spoken}>{state.word}</b> : <b>{time}</b>}
            {day && <small>{day}</small>}
        </span>
        <span className="gk-sb__teams">{team(home, away)}{team(away, home)}</span>
        {aside ?? <span className="gk-sb__score" aria-label={scored ? `${home.score}–${away.score}` : undefined}>
            <b data-win={wins(home, away) || undefined}>{scored ? home.score : '–'}</b><b data-win={wins(away, home) || undefined}>{scored ? away.score : '–'}</b>
        </span>}
        {tag && <span className="gk-sb__tag">{tag}</span>}
    </>;
    const rowProps = { className: 'gk-sb__row', title, 'data-faint': faint || undefined, 'data-open': (peek && drawers.value === peek) || undefined, 'data-peek': peek,
        'aria-current': linked?.current || undefined, 'data-highlighted': linked?.highlighted || undefined,
        onMouseEnter: linked?.onHover && (() => linked.onHover!(true)), onMouseLeave: linked?.onHover && (() => linked.onHover!(false)),
        onFocus: linked?.onHover && (() => linked.onHover!(true)), onBlur: linked?.onHover && (() => linked.onHover!(false)) };
    const show = open ?? drawers.open;
    return <li>{to ? <Link {...rowProps} to={to} onClick={peekClick(peek, show)}>{body}</Link>
        : peek ? <button type="button" {...rowProps} onClick={() => show(peek)}>{body}</button> : <div {...rowProps}>{body}</div>}</li>;
}

/** A waiting item's state in words: a dot in front (red urgent, amber decide), the word, an arrow behind. */
export function WaitTag({ tone = 'neutral', children }: { tone?: 'danger' | 'warning' | 'neutral'; children: ReactNode }) {
    return <span className="gk-sb__wait" data-tone={tone}>{children}<ArrowRight aria-hidden="true" /></span>;
}
