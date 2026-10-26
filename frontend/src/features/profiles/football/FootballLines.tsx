import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Button, ButtonLink } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { Crest } from '../../world/Crest';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { groupByClub, leaveLine, type CareerRow, type CareerTotals, type FootballHome, type FootballLine } from './api';
import './football-profile.css';

type Copy = ReturnType<typeof useJourneyCopy>;

const month = (value: string | null | undefined, copy: Copy) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(copy('en-GB', 'ka-GE'), { month: 'short', year: 'numeric' });
};
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
/** "since Sep 2024", or "since at least Sep 2024" when the start was filled in from older data. */
const sinceText = (line: Pick<FootballLine, 'since' | 'sinceKnown'>, copy: Copy) => {
    const since = month(line.since, copy);
    if (!since) return null;
    return line.sinceKnown ? copy(`since ${since}`, `${since}-დან`) : copy(`since at least ${since}`, `არანაკლებ ${since}-დან`);
};

/** A line's picture: the club's crest, the child's face, or the referee's flag. */
function LineMark({ line, size = 40 }: { line: Pick<FootballLine, 'kind' | 'home' | 'child'>; size?: number }) {
    if (line.kind === 'PARENT_OF' && line.child) return <Crest src={null} name={line.child.name} size={size} round />;
    if (line.home) return <Crest src={line.home.logoUrl} name={line.home.name} size={size} />;
    return <span className="gk-fp-mark" style={{ width: size, height: size }} aria-hidden="true"><Flag /></span>;
}

/** Where a squad chip leads: your own squads open where you work on them; others' are plain text. */
const squadPath = (role: FootballLine, squad: number, own: boolean) => !own ? null
    : role.manage === '/my-squads' ? `/my-squads?squad=${squad}` : role.kind === 'PLAYS_FOR' ? `/squads/${squad}` : null;

/**
 * "Where you are": one block per club (its crest once, then each job or place there, a head coach's squads as chips),
 * and a row for each line without a club (a child, refereeing). Rows are never ticked or typed; they come from what a
 * club or a family confirmed. Manage and Leave show on your own profile only where the rule-checker allows them (the
 * Owner hands the club over first, so has no Leave).
 */
export function FootballLines({ lines, follows = [], own, label, onChanged }: { lines: FootballLine[]; follows?: FootballHome[]; own: boolean; label?: string; onChanged?: () => void }) {
    const copy = useJourneyCopy();
    const [leaving, setLeaving] = useState<FootballLine | null>(null);
    const actions = (role: FootballLine, chips: boolean) => own && (role.leave || (role.manage && !chips)) ? <div className="gk-fp-line__actions">
        {role.leave && <Button size="sm" variant="ghost" className="gk-fp-quiet" onClick={() => setLeaving(role)}>{copy('Leave', 'დატოვება')}</Button>}
        {role.manage && !chips && <ButtonLink size="sm" to={role.manage}>{copy('Manage', 'მართვა')}</ButtonLink>}
    </div> : null;
    return <>
        <ul className="gk-fp-lines" aria-label={label ?? copy('Where you are', 'სად ხართ')}>
            {groupByClub(lines).map(group => {
                if (!group.home) {
                    const line = group.roles[0];
                    const since = sinceText(line, copy);
                    return <li key={group.key} className="gk-fp-line">
                        <LineMark line={line} />
                        <div className="gk-fp-line__text">
                            <strong>{line.kind === 'PARENT_OF' && line.child ? copy(`Parent of ${firstName(line.child.name)}`, `მშობელი: ${firstName(line.child.name)}`) : line.title}</strong>
                            {since && <span>{since}</span>}
                        </div>
                        {actions(line, false)}
                    </li>;
                }
                return <li key={group.key} className="gk-fp-line gk-fp-line--club">
                    <LineMark line={group.roles[0]} />
                    <div className="gk-fp-club">
                        <Link className="gk-fp-club__name" to={`/clubs/${group.home.id}`}>{group.home.name}</Link>
                        {group.roles.map(role => {
                            const since = sinceText(role, copy);
                            const chips = role.squads.length > 1 || squadPath(role, role.squads[0]?.id ?? 0, own) !== null;
                            return <div key={role.id} className="gk-fp-role">
                                <div className="gk-fp-role__text">
                                    <span className="gk-fp-role__name">{role.role}</span>
                                    {chips ? <span className="gk-fp-squads">{role.squads.map(squad => {
                                        const to = squadPath(role, squad.id, own);
                                        return to ? <Link key={squad.id} className="gk-fp-squad" to={to}>{squad.name}</Link> : <span key={squad.id} className="gk-fp-squad">{squad.name}</span>;
                                    })}</span> : role.squads.length > 0 && <span className="gk-fp-role__where">{role.squads[0].name}</span>}
                                    {since && <span className="gk-fp-role__since">{since}</span>}
                                </div>
                                {actions(role, chips)}
                            </div>;
                        })}
                    </div>
                </li>;
            })}
            {follows.length > 0 && <li className="gk-fp-line">
                <span className="gk-fp-follows" aria-hidden="true">{follows.slice(0, 4).map(home => <Crest key={home.id} src={home.logoUrl} name={home.name} size={28} />)}</span>
                <div className="gk-fp-line__text">
                    <strong>{copy(follows.length === 1 ? `Follows ${follows[0].name}` : `Follows ${follows.length} clubs`, follows.length === 1 ? `გამოწერილი: ${follows[0].name}` : `გამოწერილია ${follows.length} კლუბი`)}</strong>
                    <span>{copy('Their posts on Home', 'მათი პოსტები მთავარზე')}</span>
                </div>
                {own && <div className="gk-fp-line__actions"><ButtonLink size="sm" variant="ghost" to="/clubs/following">{copy('See all', 'ყველა')}</ButtonLink></div>}
            </li>}
        </ul>
        {leaving?.leave && <LeaveDialog line={leaving} onClose={() => setLeaving(null)} onLeft={() => { setLeaving(null); onChanged?.(); }} />}
    </>;
}

function LeaveDialog({ line, onClose, onLeft }: { line: FootballLine; onClose: () => void; onLeft: () => void }) {
    const copy = useJourneyCopy();
    const { refreshNavigationCapabilities } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const home = line.home?.name ?? '';
    const asStaff = line.leave?.kind === 'END_JOB' || (line.leave?.kind === 'DEPART' && line.leave.as === 'STAFF');
    const leave = async () => {
        setBusy(true); setError('');
        try {
            await leaveLine(line.leave!);
            void refreshNavigationCapabilities().catch(() => undefined);
            onLeft();
        } catch (reason) { setError(extractApiErrorMessage(reason, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ ხელახლა.'))); setBusy(false); }
    };
    return <Dialog open size="sm" role="alertdialog" onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        title={copy(`Leave ${home}?`, `დატოვებთ კლუბს — ${home}?`)}
        description={asStaff
            ? copy(`You stop being ${line.title}. The club keeps the sessions and notes; it stays in your career.`, `სამსახური „${line.title}“ დასრულდება. ვარჯიშები და ჩანაწერები კლუბს რჩება, თქვენს კარიერაში კი ეს დარჩება.`)
            : copy('You leave the squad. It stays in your career.', 'ტოვებთ გუნდს. თქვენს კარიერაში ეს დარჩება.')}
        footer={<><Button onClick={onClose} disabled={busy}>{copy('Stay', 'დარჩენა')}</Button><Button variant="danger" disabled={busy} onClick={() => void leave()}>{copy('Leave', 'დატოვება')}</Button></>}>
        {error && <p role="alert" className="gk-notice gk-notice--danger">{error}</p>}
    </Dialog>;
}

/** The career in numbers, only what the records hold: sessions coached, matches played, matches refereed. */
export function CareerTotalsRow({ totals }: { totals: CareerTotals }) {
    const copy = useJourneyCopy();
    const items = [
        { value: totals.sessionsCoached, label: copy('sessions coached', 'ჩატარებული ვარჯიში') },
        { value: totals.matchesPlayed, label: copy('matches played', 'ნათამაშები მატჩი') },
        { value: totals.matchesRefereed, label: copy('matches refereed', 'მატჩი მსაჯად') },
    ].filter(item => item.value > 0);
    if (!items.length) return null;
    return <p className="gk-fp-totals" aria-label={copy('Career in numbers', 'კარიერა ციფრებში')}>
        {items.map(item => <span key={item.label}><b className="gk-num">{item.value.toLocaleString()}</b> {item.label}</span>)}
    </p>;
}

/** Past stints as small football cards: crest, years, the job or squad, the club. */
export function CareerCards({ rows }: { rows: CareerRow[] }) {
    const copy = useJourneyCopy();
    if (!rows.length) return null;
    return <ul className="gk-fp-career" aria-label={copy('Career', 'კარიერა')}>
        {rows.map(row => {
            const start = month(row.startsOn, copy), to = month(row.endsOn, copy);
            // A start filled in from older data is a latest date: "by Sep 2021 – Jun 2024".
            const from = start && !row.startKnown ? copy(`by ${start}`, `არაუგვიანეს ${start}`) : start;
            return <li key={row.id} className="gk-fp-card">
                <div className="gk-fp-card__top">
                    <LineMark line={{ kind: row.kind, home: row.home, child: null }} size={36} />
                    <span className="gk-fp-card__years">{[from, to].filter(Boolean).join(' – ')}</span>
                </div>
                <strong className="gk-fp-card__title">{row.title}</strong>
                {row.home && <span className="gk-fp-card__home">{row.home.name}</span>}
            </li>;
        })}
    </ul>;
}
