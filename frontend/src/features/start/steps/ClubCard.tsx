import { useState, type ReactNode } from 'react';
import { MediaImage } from '../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Crest } from '../../world/Crest';

/** The app's football photos, for clubs without a picture of their own. */
const PHOTOS = ['/football/ball-field.jpg', '/venue-demo/pitch-day.jpg', '/football/touchline.jpg', '/venue-demo/pitch-sun.jpg', '/preview/club-ground.png', '/venue-demo/pitch-aerial.jpg'];

export interface CardClub { name: string; logoUrl: string | null; bannerUrl?: string | null; cityName?: string | null; km?: number | null; followers?: number; note?: string | null }

/**
 * One club as a card: its picture (or a football photo, also when its own does not load), its crest, where it is and
 * how many follow it, one action.
 */
export function ClubCard({ club, index, action }: { club: CardClub; index: number; action: ReactNode }) {
    const copy = useJourneyCopy();
    const [broken, setBroken] = useState(false);
    const banner = broken ? null : resolveMediaUrl(club.bannerUrl);
    const facts = [
        club.cityName,
        club.km != null ? copy(`${club.km} km`, `${club.km} კმ`) : null,
        club.followers != null ? copy(`${club.followers} ${club.followers === 1 ? 'follower' : 'followers'}`, `${club.followers} გამომწერი`) : null,
        club.note,
    ].filter(Boolean).join(' · ');
    return <li className="gk-welcome-club">
        <span className="gk-welcome-club__picture" aria-hidden="true">
            {banner ? <MediaImage src={banner} alt="" loading="lazy" onError={() => setBroken(true)} /> : <img src={PHOTOS[index % PHOTOS.length]} alt="" loading="lazy" />}
        </span>
        <span className="gk-welcome-club__crest"><Crest src={club.logoUrl} name={club.name} size={56} /></span>
        <span className="gk-welcome-club__text"><strong title={club.name}>{club.name}</strong>{facts && <small>{facts}</small>}</span>
        <span className="gk-welcome-club__action">{action}</span>
    </li>;
}
