import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { toggleClubFollow } from '../../api';
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

export interface Side { name: string; logo?: string | null; score?: number | null; muted?: boolean }

/** One match: when (or its state), the two sides stacked, the score, and one quiet tag. */
export function MatchLine({ to, time, day, state, home, away, tag, title }: {
    to?: string; time?: string; day?: string; /** "FT", "Live" and the like, instead of a time. */ state?: string;
    home: Side; away: Side; tag?: ReactNode; title?: string;
}) {
    const scored = home.score != null && away.score != null;
    const wins = (side: Side, other: Side) => scored && side.score! > other.score!;
    const team = (side: Side, other: Side) => <span className="gk-sb__team" data-win={wins(side, other) || undefined} data-muted={side.muted || undefined}>
        <Crest src={side.logo} name={side.name} size={18} round /><span>{side.name}</span>
    </span>;
    const body = <>
        <span className="gk-sb__when">{state ? <b data-state={state}>{state}</b> : <><b>{time}</b>{day && <small>{day}</small>}</>}</span>
        <span className="gk-sb__teams">{team(home, away)}{team(away, home)}</span>
        <span className="gk-sb__score" aria-label={scored ? `${home.score}–${away.score}` : undefined}>
            <b data-win={wins(home, away) || undefined}>{scored ? home.score : '–'}</b><b data-win={wins(away, home) || undefined}>{scored ? away.score : '–'}</b>
        </span>
        {tag && <span className="gk-sb__tag">{tag}</span>}
    </>;
    return <li>{to ? <Link className="gk-sb__row" to={to} title={title}>{body}</Link> : <div className="gk-sb__row" title={title}>{body}</div>}</li>;
}

/** One thing that is not a match (a competition, a trial): its crest, name and detail, and one fact on the right. */
export function Line({ to, crest, name, detail, when, fact, factTone }: {
    to: string; crest?: string | null; name: string; detail?: string; when?: { time?: string; day?: string };
    fact?: ReactNode; factTone?: 'warning' | 'accent' | 'danger';
}) {
    return <li><Link className="gk-sb__row gk-sb__row--line" to={to}>
        {when && <span className="gk-sb__when"><b>{when.time}</b>{when.day && <small>{when.day}</small>}</span>}
        <Crest src={crest} name={name} size={22} />
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
