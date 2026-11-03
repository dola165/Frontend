import { useCallback, useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, Section } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ClubAnnounceDialog } from './ClubAnnounceDialog';
import { ClubAnnouncementCard } from './ClubAnnouncementCard';
import { clubAnnouncements, endClubAnnouncement, type ClubAnnouncements } from './clubApi';

/**
 * The club page's announcements (M14, W5): the pinned ones for the club's people, on top of the page. Whoever may post
 * in the club's name (or for some of its squads) announces from here, sees how many each told, ends a pin early and
 * finds the last 30 days under Earlier. Signed out, or with nothing pinned for them, a visitor sees nothing.
 */
export function ClubAnnouncementsBox({ clubId }: { clubId: number }) {
    const copy = useJourneyCopy();
    const { status } = useAuth();
    const [state, setState] = useState<ClubAnnouncements | null>(null);
    const [revision, setRevision] = useState(0);
    const [writing, setWriting] = useState(false), [earlier, setEarlier] = useState(false), [ending, setEnding] = useState<number | null>(null);
    const refresh = useCallback(() => setRevision(n => n + 1), []);
    useEffect(() => {
        if (status !== 'authenticated') return;
        const abort = new AbortController();
        clubAnnouncements(clubId, abort.signal).then(setState).catch(() => { if (!abort.signal.aborted) setState(null); });
        return () => abort.abort();
    }, [clubId, status, revision]);
    if (!state || (!state.canWrite && !state.announcements.length)) return null;
    const pinned = state.announcements.filter(a => a.pinned), past = state.announcements.filter(a => !a.pinned);
    const end = async (id: number) => {
        if (!window.confirm(copy('Stop pinning this announcement for everyone?', 'შეწყდეს ამ განცხადების მიმაგრება ყველასთვის?'))) return;
        setEnding(id);
        try { await endClubAnnouncement(clubId, id); refresh(); } finally { setEnding(null); }
    };
    const trail = (a: ClubAnnouncements['announcements'][number]) => state.canWrite ? <>
        {a.told !== null && <span className="ca-told">{copy(`Sent to ${a.told}`, `გაეგზავნა ${a.told}-ს`)}</span>}
        {a.canEnd && <Button size="sm" variant="ghost" disabled={ending === a.id} onClick={() => void end(a.id)}>{copy('Unpin', 'მოხსნა')}</Button>}
    </> : undefined;
    return <Section boxed icon={Megaphone} title={copy('Announcements', 'განცხადებები')} className="ca-box" id="club-announcements"
        hint={state.canWrite ? copy('To the club’s families, players and staff', 'კლუბის ოჯახებს, მოთამაშეებსა და პერსონალს') : undefined}
        action={state.canWrite ? <Button size="sm" variant="secondary" onClick={() => setWriting(true)}><Megaphone aria-hidden="true" />{copy('Announce', 'განცხადება')}</Button> : undefined}>
        {pinned.length ? <div className="ca-list">{pinned.map(a => <ClubAnnouncementCard key={a.id} announcement={a} trail={trail(a)} />)}</div>
            : <p className="ca-quiet">{copy('Nothing pinned now.', 'ახლა არაფერია მიმაგრებული.')}</p>}
        {past.length > 0 && <button type="button" className="ca-link" aria-expanded={earlier} onClick={() => setEarlier(value => !value)}>{earlier ? copy('Hide earlier', 'ძველის დამალვა') : copy(`Earlier (${past.length})`, `ძველი (${past.length})`)}</button>}
        {earlier && <div className="ca-list ca-list--past">{past.map(a => <ClubAnnouncementCard key={a.id} announcement={a} trail={trail(a)} />)}</div>}
        {writing && <ClubAnnounceDialog clubId={clubId} rights={state} onClose={() => setWriting(false)} onSent={refresh} />}
    </Section>;
}
