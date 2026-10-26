import { ChoiceTiles } from '../../design/ChoiceTiles';
import { Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { Crest } from '../world/Crest';
import type { NearbyClub } from './startApi';

/**
 * Clubs as tiles to tick: crest, name, town and distance. Several at once, or one (`single`, finding your own club).
 * Nothing happens until the welcome's main button: then the ticked clubs are followed.
 */
export function ClubPicker({ clubs, chosen, onToggle, label, single = false, empty }: {
    clubs: NearbyClub[] | null; chosen: ReadonlySet<number>; onToggle: (id: number) => void; label: string; single?: boolean; empty: string;
}) {
    const copy = useJourneyCopy();
    if (!clubs) return <div role="status" aria-label={copy('Loading clubs', 'კლუბები იტვირთება')} className="gk-welcome__loading"><Skeleton height={52} /><Skeleton height={52} /><Skeleton height={52} /></div>;
    if (!clubs.length) return <p className="gk-welcome__hint">{empty}</p>;
    return <ChoiceTiles compact single={single} label={label} chosen={[...chosen].map(String)} onToggle={id => onToggle(Number(id))}
        items={clubs.map(club => ({
            id: String(club.id), label: club.name, icon: <Crest src={club.logoUrl} name={club.name} size={32} />,
            hint: [club.cityName, club.km != null ? copy(`${Math.round(club.km)} km`, `${Math.round(club.km)} კმ`) : null].filter(Boolean).join(' · ') || undefined,
        }))} />;
}
