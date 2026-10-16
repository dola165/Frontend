import './announcements.css';
import { useState } from 'react';
import { Button, GkRoot } from '../../design/primitives';
import { useWorldData } from '../world/useWorldData';
import * as api from '../squadCommunication/api';

/**
 * For the coaching team: how many families have acknowledged an announcement that asks them to (F19: an absent
 * acknowledgement is "not acknowledged", never "not read"),
 * and who has not yet. Names are listed on request; nothing is counted that the server did not report.
 */
export function ReadReceipts({ squadId, message, compact = false }: { squadId: number; message: api.SquadMessage; compact?: boolean }) {
    const [open, setOpen] = useState(false);
    const reported = message.acknowledged_by?.length ?? 0;
    const receipts = useWorldData(`receipts:${squadId}:${message.id}:${reported}`, () => api.receipts(squadId, message.id), 'Read receipts could not load.');
    const rows = receipts.data ?? [];
    const read = rows.filter(row => row.acknowledged_at), unread = rows.filter(row => !row.acknowledged_at);
    const total = rows.length;
    const share = total ? Math.round((read.length / total) * 100) : 0;
    const bar = <span className="gk-receipts__bar" role="img" aria-label={`${share}% acknowledged`}><span style={{ width: `${share}%` }} /></span>;
    return (
        <GkRoot className={`gk-receipts${compact ? ' gk-receipts--compact' : ''}`}>
            {receipts.loading ? <span className="gk-receipts__summary gk-faint">Checking who acknowledged it…</span>
                : receipts.error ? <span className="gk-receipts__summary">Acknowledged by {reported} <Button size="sm" variant="ghost" onClick={receipts.retry}>Load names</Button></span>
                    : <>
                        <div className="gk-receipts__line">
                            <span className="gk-receipts__summary"><strong className="gk-num">{read.length}</strong> of <span className="gk-num">{total}</span> {total === 1 ? 'family has' : 'families have'} acknowledged it</span>
                            {compact && bar}
                            {total > 0 && <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Hide names' : unread.length ? `Who hasn’t (${unread.length})` : 'Who acknowledged it'}</Button>}
                        </div>
                        {!compact && bar}
                        {open && <div className="gk-receipts__names">
                            {unread.length > 0 && <div><p className="gk-receipts__group">Not acknowledged</p><ul>{unread.map(row => <li key={row.user_id}>{row.full_name}</li>)}</ul></div>}
                            {read.length > 0 && <div><p className="gk-receipts__group">Acknowledged</p><ul>{read.map(row => <li key={row.user_id}>{row.full_name}<span className="gk-faint">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(row.acknowledged_at!))}</span></li>)}</ul></div>}
                        </div>}
                    </>}
        </GkRoot>
    );
}
