import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Avatar, Section, Skeleton } from '../../../design/primitives';
import { FaceStack } from '../../../design/visuals';
import { relativeTime } from '../../../utils/relativeTime';
import { useJourneyCopy } from '../journeyCopy';
import { NotifySquadButton } from '../NotifySquad';
import type * as api from '../api';
import { useMarkSeen, useNoticeLines } from './useNoticeLines';
import './notice-lines.css';

const SHOWN = 5;

/**
 * The squad page's Notify lines (M12): each line as it was sent. The coaches and staff see every line with the faces
 * of the people it went to, ringed once they have seen it, and the names on request; the coaches send one from here.
 * Anyone else sees the lines sent to them, which counts as seen. No replies (a later step). Hidden for a family or
 * player with no line yet: the page keeps one main thing.
 */
export function NoticeLines({ space }: { space: api.SquadOverview }) {
    const copy = useJourneyCopy();
    const { lines, loading, error, refresh } = useNoticeLines([space.id]);
    const [all, setAll] = useState(false);
    const works = space.can_manage || space.coaches.some(coach => coach.user_id === space.viewer_id);
    const shown = all ? lines : lines.slice(0, SHOWN);
    // Only the lines on screen count as seen; the rest when All opens.
    useMarkSeen(shown);
    if (!works && !lines.length) return null;
    return <Section boxed icon={Bell} title={copy('Notify', 'შეტყობინება')} className="nl" id="squad-notify"
        hint={works ? copy('One line, at once, to their phones', 'ერთი ხაზი, მაშინვე, ტელეფონზე') : copy('Lines from the coaches', 'მწვრთნელების შეტყობინებები')}
        action={space.can_manage ? <NotifySquadButton squads={[{ id: space.id, name: space.name }]} focus={space.id} onSent={refresh} /> : undefined}>
        {loading ? <Skeleton height={56} />
            : !lines.length ? <p className="nl-quiet">{copy('Nothing sent yet.', 'ჯერ არაფერი გაგზავნილა.')}</p>
            : <ul className="nl-list">{shown.map(({ notice }) => <NoticeRow key={notice.id} notice={notice} works={works} />)}</ul>}
        {lines.length > SHOWN && <button type="button" className="nl-link" onClick={() => setAll(value => !value)}>{all ? copy('Show fewer', 'ნაკლები') : copy(`All ${lines.length}`, `ყველა ${lines.length}`)}</button>}
        {error && <p className="nl-quiet" role="alert">{copy('Couldn’t load the lines.', 'შეტყობინებები ვერ ჩაიტვირთა.')} <button type="button" className="nl-link" onClick={refresh}>{copy('Try again', 'ხელახლა ცდა')}</button></p>}
    </Section>;
}

/** Who a line went to, in words. */
function audienceLabel(audience: api.NoticeAudience, copy: (en: string, ka: string) => string) {
    return audience === 'PARENTS' ? copy('Parents', 'მშობლები') : audience === 'PLAYERS' ? copy('Players', 'მოთამაშეები')
        : audience === 'STAFF' ? copy('Staff', 'პერსონალი') : copy('Whole squad', 'მთელი გუნდი');
}

function NoticeRow({ notice, works }: { notice: api.NoticeLine; works: boolean }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    const seen = notice.sentTo.filter(person => person.seen), waiting = notice.sentTo.filter(person => !person.seen);
    return <li className="nl-row" id={`squad-notice-${notice.id}`}>
        <span className="nl-row__icon" aria-hidden="true"><Bell /></span>
        <div className="nl-row__text">
            <strong>{notice.line}</strong>
            <small>{notice.authorName} · {relativeTime(notice.createdAt)}{works ? ` · ${audienceLabel(notice.audience, copy)}` : ''}</small>
            {works && open && <div className="nl-names">
                {waiting.length > 0 && <People label={copy('Not seen yet', 'ჯერ არ უნახავს')} people={waiting} />}
                {seen.length > 0 && <People label={copy('Seen', 'ნახეს')} people={seen} />}
            </div>}
        </div>
        {works && notice.sentTo.length > 0 && <button type="button" className="nl-seen" aria-expanded={open} onClick={() => setOpen(value => !value)}>
            <FaceStack people={[...seen, ...waiting].map(person => ({ id: person.userId, name: person.name, tone: person.seen ? 'accent' : undefined }))} max={5} size={22} />
            <span>{copy(`${seen.length} of ${notice.sentTo.length} seen`, `ნახა ${seen.length}-მა ${notice.sentTo.length}-დან`)}</span>
        </button>}
    </li>;
}

function People({ label, people }: { label: string; people: api.NoticeSeen[] }) {
    return <div className="nl-names__group"><span className="nl-names__label">{label}</span>
        <ul className="nl-people">{people.map(person => <li key={person.userId}><Avatar name={person.name} size={20} />{person.name}</li>)}</ul></div>;
}
