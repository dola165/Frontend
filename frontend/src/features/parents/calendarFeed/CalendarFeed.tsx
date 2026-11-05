import { useEffect, useState } from 'react';
import { CalendarPlus, ChevronRight, Copy } from 'lucide-react';
import { Dialog } from '../../../design/Dialog';
import { Button, ButtonAnchor } from '../../../design/primitives';
import { relativeTime } from '../../../utils/relativeTime';
import { formatDate } from '../../../utils/formatting';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { calendarFeedStatus, calendarLinks, makeCalendarFeed, stopCalendarFeed, type CalendarFeedStatus } from './calendarFeedApi';
import './calendar-feed.css';

/**
 * Parent Hub's door to the phone's calendar (W4): one quiet row that opens the private link. Off, one press makes it;
 * just made, it is shown once with Copy, Google Calendar and Apple; on, it says when a calendar last read it, with New
 * link (the old one stops) and Stop. `names` are the children whose sessions it holds; with none there is no row
 * (fix round 2, W8: a player's own link is a later step).
 */
export function CalendarFeedRow({ names }: { names: string[] }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    if (!names.length) return null;
    return <>
        <button type="button" className="ph-details-link cf-row" onClick={() => setOpen(true)}>
            <span><CalendarPlus aria-hidden="true" />{copy('Sessions in your phone’s calendar', 'ვარჯიშები ტელეფონის კალენდარში')}</span><ChevronRight aria-hidden="true" />
        </button>
        {open && <CalendarFeedDialog names={names} onClose={() => setOpen(false)} />}
    </>;
}

function CalendarFeedDialog({ names, onClose }: { names: string[]; onClose: () => void }) {
    const copy = useJourneyCopy();
    const [status, setStatus] = useState<CalendarFeedStatus | null | 'error'>(null);
    const [made, setMade] = useState<string | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
    useEffect(() => {
        const abort = new AbortController();
        calendarFeedStatus(abort.signal).then(setStatus).catch(() => { if (!abort.signal.aborted) setStatus('error'); });
        return () => abort.abort();
    }, []);
    const act = async (work: () => Promise<void>) => {
        setBusy(true); setError('');
        try { await work(); } catch { setError(copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ ხელახლა.')); } finally { setBusy(false); }
    };
    const make = () => act(async () => { const feed = await makeCalendarFeed(); setMade(feed.path); setStatus({ on: true, createdAt: feed.createdAt, lastReadAt: null, forChildren: true }); setCopied(false); });
    const renew = () => { if (window.confirm(copy('Make a new link? Calendars on the old one stop updating.', 'შეიქმნას ახალი ბმული? ძველ ბმულზე კალენდრები აღარ განახლდება.'))) void make(); };
    const stop = () => act(async () => { await stopCalendarFeed(); setMade(null); setStatus(current => ({ on: false, createdAt: null, lastReadAt: null, forChildren: current !== null && current !== 'error' && current.forChildren })); });
    const links = made ? calendarLinks(made) : null;
    const who = names.join(', ');
    return <Dialog open size="sm" className="cf-dialog" title={copy('Sessions in your phone’s calendar', 'ვარჯიშები ტელეფონის კალენდარში')}
        description={who ? copy(`${who}: sessions and matches, kept up to date`, `${who}: ვარჯიშები და მატჩები, ყოველთვის განახლებული`) : undefined}
        onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
        {status === null ? <p className="cf-quiet" role="status">{copy('Loading…', 'იტვირთება…')}</p>
            : status === 'error' ? <p className="gk-notice gk-notice--danger" role="alert">{copy('Couldn’t load your link.', 'ბმული ვერ ჩაიტვირთა.')}</p>
            : links ? <div className="cf-made">
                <label className="cf-label" htmlFor="cf-url">{copy('Your private link', 'თქვენი პირადი ბმული')}</label>
                <div className="cf-copy"><input id="cf-url" className="gk-input" readOnly value={links.url} onFocus={event => event.target.select()} />
                    <Button onClick={() => navigator.clipboard.writeText(links.url).then(() => setCopied(true), () => setCopied(false))}><Copy aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button></div>
                <div className="cf-apps">
                    <ButtonAnchor variant="primary" href={links.google} target="_blank" rel="noopener noreferrer">{copy('Add to Google Calendar', 'Google Calendar-ში დამატება')}</ButtonAnchor>
                    <ButtonAnchor href={links.webcal}>{copy('Add on iPhone or Mac', 'iPhone-ზე ან Mac-ზე დამატება')}</ButtonAnchor>
                </div>
                <p className="cf-quiet">{copy('Shown once. Anyone with it sees these sessions, so keep it to yourself.', 'ჩანს ერთხელ. ვისაც აქვს, ხედავს ამ ვარჯიშებს — ნუ გაუზიარებთ.')}</p>
            </div>
            : status.on ? <div className="cf-on">
                <p><strong>{copy('Your link is on', 'ბმული ჩართულია')}</strong><br />
                    <span className="cf-quiet">{copy(`Made ${formatDate(status.createdAt!, { day: 'numeric', month: 'short' })}`, `შექმნილია ${formatDate(status.createdAt!, { day: 'numeric', month: 'short' })}`)} · {status.lastReadAt
                        ? copy(`a calendar read it ${relativeTime(status.lastReadAt)}`, `კალენდარმა წაიკითხა ${relativeTime(status.lastReadAt)}`)
                        : copy('no calendar has read it yet', 'კალენდარს ჯერ არ წაუკითხავს')}</span></p>
                <div className="cf-apps"><Button variant="secondary" disabled={busy} onClick={renew}>{copy('New link', 'ახალი ბმული')}</Button><Button variant="ghost" disabled={busy} onClick={() => void stop()}>{copy('Stop the link', 'ბმულის გაჩერება')}</Button></div>
            </div>
            : !status.forChildren ? <p className="cf-quiet">{copy('The link holds your children’s sessions. Add a child to make one.', 'ბმულში თქვენი ბავშვების ვარჯიშებია. შესაქმნელად დაამატეთ ბავშვი.')}</p>
            : <div className="cf-off">
                <Button variant="primary" disabled={busy} onClick={() => void make()}><CalendarPlus aria-hidden="true" />{copy('Make my link', 'ბმულის შექმნა')}</Button>
                <p className="cf-quiet">{copy('Your calendar shows each session with your child’s first name and the place. Only you get the link.', 'კალენდარში ჩანს თითოეული ვარჯიში ბავშვის სახელით და ადგილით. ბმული მხოლოდ თქვენ გაქვთ.')}</p>
            </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
