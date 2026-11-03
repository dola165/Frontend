import { useEffect, useState } from 'react';
import { ClubAnnouncementCard } from './ClubAnnouncementCard';
import { myClubAnnouncements, type ClubAnnouncement } from './clubApi';

/**
 * Parent Hub's pinned club announcements (M14, W5): those of these squads' clubs that are for the whole club or for one
 * of these squads, until they expire. Nothing pinned, or a failed load, shows nothing; the rest of the page stands.
 */
export function ClubPinned({ squads }: { squads: { id: number; club_id?: number }[] }) {
    const [all, setAll] = useState<ClubAnnouncement[]>([]);
    useEffect(() => {
        const abort = new AbortController();
        const load = () => void myClubAnnouncements(abort.signal).then(setAll).catch(() => undefined);
        load();
        const again = () => { if (!document.hidden) load(); };
        window.addEventListener('focus', again);
        return () => { abort.abort(); window.removeEventListener('focus', again); };
    }, []);
    const clubs = new Set(squads.flatMap(squad => squad.club_id ? [squad.club_id] : [])), ids = new Set(squads.map(squad => squad.id));
    const shown = all.filter(a => a.pinned && clubs.has(a.clubId) && (!a.squadIds.length || a.squadIds.some(id => ids.has(id))));
    if (!shown.length) return null;
    return <div className="ca-list ca-pinned" aria-label="Pinned">{shown.map(a => <ClubAnnouncementCard key={a.id} announcement={a} club={clubs.size > 1} />)}</div>;
}
