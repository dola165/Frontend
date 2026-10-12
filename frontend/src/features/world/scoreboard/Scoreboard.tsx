import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { toggleClubFollow } from '../api';
import { peekClick, usePeek } from '../peek/usePeek';
import type { WhenTone } from './matchState';
import './scoreboard.css';

/**
 * Lists in the familiar scoreboard shape (Flashscore and the like): a header per competition or day, then dense
 * rows with the time on the left, the two teams stacked with their crests, and the score on the right.
 */
export function ScoreGroups<T>({ items, group, children, label }: { items: T[]; group: (item: T) => string; children: (item: T) => ReactNode; label: string }) {
    const groups = new Map<string, T[]>();
    for (const item of items) groups.set(group(item), [...(groups.get(group(item)) ?? []), item]);
    return (
        <div className="gk-sb" aria-label={label}>
            {[...groups].map(([name, rows]) => <section key={name} className="gk-sb__group" aria-label={name}>
                <h3 className="gk-sb__head"><span>{name}</span><small>{rows.length}</small></h3>
                <ul className="gk-sb__rows">{rows.map(children)}</ul>
            </section>)}
        </div>
    );
}

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
export function MatchLine({ to, peek, time, day, state, home, away, tag, title, aside, linked, faint }: {
    to?: string; peek?: string; time?: string; day?: string; state?: LineState;
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
    const rowProps = { className: 'gk-sb__row', title, 'data-faint': faint || undefined, 'data-open': (peek && drawers.value === peek) || undefined,
        'aria-current': linked?.current || undefined, 'data-highlighted': linked?.highlighted || undefined,
        onMouseEnter: linked?.onHover && (() => linked.onHover!(true)), onMouseLeave: linked?.onHover && (() => linked.onHover!(false)),
        onFocus: linked?.onHover && (() => linked.onHover!(true)), onBlur: linked?.onHover && (() => linked.onHover!(false)) };
    return <li>{to ? <Link {...rowProps} to={to} onClick={peekClick(peek, drawers.open)}>{body}</Link>
        : peek ? <button type="button" {...rowProps} onClick={() => drawers.open(peek)}>{body}</button> : <div {...rowProps}>{body}</div>}</li>;
}

/**
 * One thing that is not a match (a competition, a trial, an event): its crest (or its activity's symbol in a soft
 * tint), name and detail, and one fact on the right.
 */
export function Line({ to, crest, icon, name, detail, when, fact, factTone, linked }: {
    to: string; crest?: string | null; icon?: { Icon: LucideIcon; color: string }; name: string; detail?: string; when?: { time?: string; day?: string };
    fact?: ReactNode; factTone?: 'warning' | 'accent' | 'danger'; linked?: Linked;
}) {
    const hover = linked?.onHover && { onMouseEnter: () => linked.onHover!(true), onMouseLeave: () => linked.onHover!(false), onFocus: () => linked.onHover!(true), onBlur: () => linked.onHover!(false) };
    return <li><Link className="gk-sb__row gk-sb__row--line" to={to} aria-current={linked?.current || undefined} data-highlighted={linked?.highlighted || undefined} {...hover}>
        {when && <span className="gk-sb__when"><b>{when.time}</b>{when.day && <small>{when.day}</small>}</span>}
        {icon ? <span className="gk-sb__symbol" style={{ '--symbol': icon.color } as CSSProperties} aria-hidden="true"><icon.Icon /></span> : <Crest src={crest} name={name} size={22} />}
        <span className="gk-sb__main"><strong>{name}</strong>{detail && <small>{detail}</small>}</span>
        {fact && <span className="gk-sb__fact" data-tone={factTone}>{fact}</span>}
    </Link></li>;
}

/** A club in a scoreboard list: the star follows it, as favourites do on score sites. */
export function ClubLine({ id, name, logo, detail, fact, followed }: { id: number; name: string; logo?: string | null; detail?: string; fact?: string; followed: boolean }) {
    const t = useWorldCopy();
    const { status } = useAuth();
    const [on, setOn] = useState(followed), [busy, setBusy] = useState(false);
    const toggle = async () => {
        if (busy) return;
        setBusy(true); setOn(value => !value);
        try { await toggleClubFollow(id); } catch { setOn(value => !value); } finally { setBusy(false); }
    };
    return <li className="gk-sb__club">
        {status === 'authenticated' && <button type="button" className="gk-sb__star" aria-pressed={on} aria-label={on ? t('Stop following {name}', { name }) : t('Follow {name}', { name })} disabled={busy} onClick={() => void toggle()}><Star aria-hidden="true" /></button>}
        <Link className="gk-sb__row gk-sb__row--line" to={`/clubs/${id}`}>
            <Crest src={logo} name={name} size={24} />
            <span className="gk-sb__main"><strong>{name}</strong>{detail && <small>{detail}</small>}</span>
            {fact && <span className="gk-sb__fact">{fact}</span>}
        </Link>
    </li>;
}

/** A waiting item's state in words: a dot in front (red urgent, amber decide), the word, an arrow behind. */
export function WaitTag({ tone = 'neutral', children }: { tone?: 'danger' | 'warning' | 'neutral'; children: ReactNode }) {
    return <span className="gk-sb__wait" data-tone={tone}>{children}<ArrowRight aria-hidden="true" /></span>;
}
