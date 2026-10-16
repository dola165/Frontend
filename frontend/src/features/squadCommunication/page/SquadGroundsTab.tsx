import { useMemo } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { useJourneyCopy } from '../journeyCopy';
import { useSquadSchedule } from '../useSquadSchedule';
import type * as api from '../api';

/** Where the squad trains and plays in the next four weeks: each ground once, with what happens there and when. */
export function SquadGroundsTab({ space, childId }: { space: api.SquadOverview; childId?: number }) {
    const copy = useJourneyCopy();
    const range = useMemo(() => { const from = new Date(); from.setHours(0, 0, 0, 0); return { from: from.toISOString(), to: new Date(from.getTime() + 29 * 86400000).toISOString() }; }, []);
    const { events, loading } = useSquadSchedule([space], range.from, range.to, 0, space.can_manage ? undefined : childId, false);
    const grounds = useMemo(() => {
        const byPlace = new Map<string, { name: string; training: Set<string>; matches: number; next: string }>();
        for (const event of events.filter(e => e.locationText && e.status !== 'CANCELLED').sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
            const name = event.locationText!.split(/ · |, /)[0];
            const place = byPlace.get(name) ?? { name, training: new Set<string>(), matches: 0, next: event.startsAt };
            if (event.eventType === 'TRAINING') place.training.add(formatDate(event.startsAt, { weekday: 'short' })); else place.matches += 1;
            byPlace.set(name, place);
        }
        return [...byPlace.values()];
    }, [events]);
    if (loading) return <Skeleton height={120} />;
    if (!grounds.length) return <p className="sp-quiet">{copy('No grounds planned in the next four weeks.', 'მომდევნო ოთხ კვირაში მოედნები არ არის დაგეგმილი.')}</p>;
    const Training = activityIcons.TRAINING, Match = activityIcons.MATCH;
    return <ul className="sp-grounds">{grounds.map(ground => <li key={ground.name} className="sp-ground">
        <span className="sp-ground__pin" aria-hidden="true"><MapPin /></span>
        <span className="sp-ground__text"><strong>{ground.name}</strong>
            <span className="sp-ground__uses">
                {ground.training.size > 0 && <span style={{ color: activityColors.TRAINING }}><Training aria-hidden="true" />{copy('Trains', 'ვარჯიში')} {[...ground.training].join(', ')}</span>}
                {ground.matches > 0 && <span style={{ color: activityColors.MATCH }}><Match aria-hidden="true" />{copy(`${ground.matches} ${ground.matches === 1 ? 'match' : 'matches'}`, `${ground.matches} მატჩი`)}</span>}
            </span></span>
        <a className="sp-link sp-ground__go" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ground.name}, Georgia`)}`} target="_blank" rel="noopener noreferrer">{copy('Directions', 'მიმართულება')}<ExternalLink aria-hidden="true" /></a>
    </li>)}</ul>;
}
