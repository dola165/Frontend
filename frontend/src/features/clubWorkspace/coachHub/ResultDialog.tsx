import { useState } from 'react';
import { Button } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { Crest } from '../../../design/visuals';
import { completeClubEventWithResult } from '../../schedule/api';

/** What the dialog needs to know about a match: enough from the club calendar or the match history alike. */
export interface ResultMatch { eventId: number; title: string; startsAt: string; clubId: number | null; opponentClubId: number | null }
import { extractApiErrorMessage } from '../../../utils/apiError';
import { dayLabel, timeLabel } from '../fixtures';
import './coach-hub.css';

/** The two sides of a match from its title ("A v B"), home first; null when the title does not say. */
const sidesOf = (title: string) => { const parts = title.split(/\s+v(?:s\.?)?\s+/i); return parts.length === 2 ? [parts[0].trim(), parts[1].trim()] as const : null; };

/**
 * The score after a match: two numbers, one press. Saved on the club calendar, so the club page and the feed
 * get the result on their own. Which side is home comes from the match title; otherwise the sides are Home and Away.
 */
export function ResultDialog({ match: event, clubId, clubName, clubLogo, now, onClose, onDone }: {
    match: ResultMatch; clubId: number; clubName: string; clubLogo: string | null; now: number; onClose: () => void; onDone: () => void;
}) {
    const sides = sidesOf(event.title);
    const ours = sides ? sides.findIndex(side => side.toLowerCase().includes(clubName.toLowerCase()) || clubName.toLowerCase().includes(side.toLowerCase())) : -1;
    const names = sides ?? ['Home', 'Away'];
    const [home, setHome] = useState(''), [away, setAway] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const valid = /^\d{1,2}$/.test(home) && /^\d{1,2}$/.test(away);

    const save = async () => {
        if (busy || !valid) return;
        setBusy(true); setError('');
        const h = Number(home), a = Number(away);
        // The winner's club id is only known for our side and the opponent's; a draw has none.
        const winner = h === a ? null : (h > a) === (ours === 0) ? (event.clubId ?? clubId) : event.opponentClubId ?? null;
        try { await completeClubEventWithResult(clubId, event.eventId, { homeScore: h, awayScore: a, winnerClubId: ours === -1 ? null : winner }); onDone(); }
        catch (cause) { setError(extractApiErrorMessage(cause, 'The result could not be saved.')); setBusy(false); }
    };

    const side = (index: 0 | 1, value: string, set: (value: string) => void) => <label className="ch-score__side">
        <span className="ch-score__name">{index === ours ? <Crest src={clubLogo} name={clubName} size={28} /> : <Crest src={null} name={names[index]} size={28} />}<strong>{names[index]}</strong></span>
        <input className="gk-input ch-score__input" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${names[index]} goals`} value={value} disabled={busy} autoFocus={index === 0}
            onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 2))} />
    </label>;

    return <Dialog open size="sm" title="Add the result" description={`${event.title} · ${dayLabel(event.startsAt, now)} ${timeLabel(event.startsAt)}`} onClose={onClose}
        footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Not now</Button><Button variant="primary" disabled={busy || !valid} onClick={() => void save()}>{busy ? 'Saving…' : 'Save result'}</Button></>}>
        <div className="ch-score">{side(0, home, setHome)}<span className="ch-score__dash">–</span>{side(1, away, setAway)}</div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
