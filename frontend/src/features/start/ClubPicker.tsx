import { Check } from 'lucide-react';
import { ChoiceTiles } from '../../design/ChoiceTiles';
import { Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { Crest } from '../world/Crest';
import type { NearbyClub } from './startApi';

/**
 * Clubs as tiles to follow with a heart: crest, name, town and distance, then the programme that takes the age asked
 * about (its name, how often, what it costs) or, without one, how many follow the club. Several at once; nothing
 * happens until the welcome's main button: then the hearted clubs are followed.
 */
export function ClubPicker({ clubs, chosen, onToggle, label, empty }: {
    clubs: NearbyClub[] | null; chosen: ReadonlySet<number>; onToggle: (id: number) => void; label: string; empty: string;
}) {
    const copy = useJourneyCopy();
    if (!clubs) return <div role="status" aria-label={copy('Loading clubs', 'კლუბები იტვირთება')} className="gk-welcome__loading"><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></div>;
    if (!clubs.length) return <p className="gk-welcome__hint">{empty}</p>;
    const place = (club: NearbyClub) => [club.cityName, club.km != null ? copy(`${Math.round(club.km)} km`, `${Math.round(club.km)} კმ`) : null].filter(Boolean).join(' · ');
    const often = (sessions: number | null) => sessions ? copy(`${sessions}× a week`, `კვირაში ${sessions}-ჯერ`) : null;
    return <ChoiceTiles compact mark="heart" label={label} chosen={[...chosen].map(String)} onToggle={id => onToggle(Number(id))}
        items={clubs.map(club => ({
            id: String(club.id), label: club.name, icon: <Crest src={club.logoUrl} name={club.name} size={40} />,
            hint: <span className="gk-welcome-club">
                {place(club) && <span>{place(club)}</span>}
                {club.programme
                    ? <><span className="gk-welcome-club__fit"><Check aria-hidden="true" />{club.programme.name}</span>
                        <span>{[club.programme.ages, often(club.programme.sessionsPerWeek), club.programme.fee].filter(Boolean).join(' · ')}</span></>
                    : <span>{copy(`${club.followers} ${club.followers === 1 ? 'follower' : 'followers'}`, `${club.followers} გამომწერი`)}</span>}
            </span>,
        }))} />;
}
