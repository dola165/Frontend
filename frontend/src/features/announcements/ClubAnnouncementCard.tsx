import './club-announcements.css';
import type { ReactNode } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { MessageText } from '../../components/chat/MessageText';
import { formatDate } from '../../utils/formatting';
import { relativeTime } from '../../utils/relativeTime';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ClubAnnouncement } from './clubApi';

/** Who an announcement is for, in words: the whole club or its squads. */
function useAudience() {
    const copy = useJourneyCopy();
    return (a: Pick<ClubAnnouncement, 'squadNames'>) => a.squadNames.length ? a.squadNames.join(' · ') : copy('Whole club', 'მთელი კლუბი');
}

/**
 * One club announcement as a pinned card: the pin and how long it stays, the title, the words, who it is for and who
 * wrote it. `club` adds the club's name (Parent Hub, where a family may follow several clubs); `trail` holds the
 * writer's quiet actions.
 */
export function ClubAnnouncementCard({ announcement: a, club = false, trail }: { announcement: ClubAnnouncement; club?: boolean; trail?: ReactNode }) {
    const copy = useJourneyCopy();
    const audience = useAudience();
    const until = formatDate(a.expiresAt, { weekday: 'short', day: 'numeric', month: 'short' });
    return <article className="ca-card" data-pinned={a.pinned || undefined} id={`club-announcement-${a.id}`}>
        <span className="ca-card__pin" aria-hidden="true">{a.pinned ? <Pin /> : <PinOff />}</span>
        <div className="ca-card__text">
            <small className="ca-card__state">{a.pinned ? copy(`Pinned until ${until}`, `მიმაგრებულია ${until}-მდე`) : copy('No longer pinned', 'აღარ არის მიმაგრებული')}{club ? ` · ${a.clubName}` : ''}</small>
            <strong className="ca-card__title">{a.title}</strong>
            {a.body && <p className="ca-card__body"><MessageText text={a.body} /></p>}
            <small className="ca-card__meta">{audience(a)} · {a.authorName} · {relativeTime(a.createdAt)}</small>
        </div>
        {trail && <div className="ca-card__trail">{trail}</div>}
    </article>;
}
