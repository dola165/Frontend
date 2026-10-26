import { useState } from 'react';
import { Flag } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Button, ButtonLink } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { Crest } from '../../world/Crest';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { leaveLine, type CareerRow, type CareerTotals, type FootballHome, type FootballLine } from './api';
import './football-profile.css';

type Copy = ReturnType<typeof useJourneyCopy>;

const month = (value: string | null | undefined, copy: Copy) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(copy('en-GB', 'ka-GE'), { month: 'short', year: 'numeric' });
};
const year = (value: string | null | undefined) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.getFullYear() : null;
};
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** A line's picture: the club's crest, the child's face, or the referee's flag. */
function LineMark({ line, size = 40 }: { line: Pick<FootballLine, 'kind' | 'home' | 'child'>; size?: number }) {
    if (line.kind === 'PARENT_OF' && line.child) return <Crest src={null} name={line.child.name} size={size} round />;
    if (line.home) return <Crest src={line.home.logoUrl} name={line.home.name} size={size} />;
    return <span className="gk-fp-mark" style={{ width: size, height: size }} aria-hidden="true"><Flag /></span>;
}

const lineTitle = (line: FootballLine, copy: Copy) => line.kind === 'PARENT_OF' && line.child
    ? copy(`Parent of ${firstName(line.child.name)}`, `${firstName(line.child.name)}-ს მშობელი`)
    : line.title;

/**
 * "Where you are": one row per real link or job, with its crest or face, and Manage or Leave beside it on your own
 * profile. Rows are never ticked or typed; they come from what a club or a family confirmed. Leave and Manage show only
 * when the rule-checker allows them (the Owner hands the club over first, so has no Leave).
 */
export function FootballLines({ lines, follows = [], own, onChanged }: { lines: FootballLine[]; follows?: FootballHome[]; own: boolean; onChanged?: () => void }) {
    const copy = useJourneyCopy();
    const [leaving, setLeaving] = useState<FootballLine | null>(null);
    return <>
        <ul className="gk-fp-lines" aria-label={copy('Where you are', 'სად ხართ')}>
            {lines.map(line => {
                const since = month(line.since, copy);
                return <li key={line.id} className="gk-fp-line">
                    <LineMark line={line} />
                    <div className="gk-fp-line__text">
                        <strong>{lineTitle(line, copy)}</strong>
                        <span>{[line.home?.name, since ? copy(`since ${since}`, `${since}-დან`) : null].filter(Boolean).join(' · ')}</span>
                    </div>
                    {own && (line.leave || line.manage) && <div className="gk-fp-line__actions">
                        {line.leave && <Button size="sm" variant="ghost" className="gk-fp-quiet" onClick={() => setLeaving(line)}>{copy('Leave', 'დატოვება')}</Button>}
                        {line.manage && <ButtonLink size="sm" to={line.manage}>{copy('Manage', 'მართვა')}</ButtonLink>}
                    </div>}
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
        title={copy(`Leave ${home}?`, `დატოვებთ ${home}-ს?`)}
        description={asStaff
            ? copy(`You stop being ${line.title}. The club keeps the sessions and notes; it stays in your career.`, `აღარ იქნებით ${line.title}. კლუბს რჩება ვარჯიშები და ჩანაწერები; თქვენს კარიერაში ეს დარჩება.`)
            : copy(`You leave as ${line.title}. It stays in your career.`, `ტოვებთ როგორც ${line.title}. თქვენს კარიერაში ეს დარჩება.`)}
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
        { value: totals.matchesRefereed, label: copy('matches refereed', 'მსაჯობით მატჩი') },
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
            const from = year(row.startsOn), to = year(row.endsOn);
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
