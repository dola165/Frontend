import { useLocation } from 'react-router-dom';
import { BriefcaseBusiness, CalendarDays, Map as MapIcon, Shield, Trophy, UsersRound } from 'lucide-react';
import { RouteTabs } from '../../design/Tabs';
import { useWorldCopy } from './copy';
import { CARRIED } from './directory/useDirectoryState';

/**
 * World's places, in the order people want them: the map first, then clubs, jobs and volunteering, matches,
 * tournaments and people. Venues and Journeys are out (journey planning still answers its own links at `/world/map?plans=`).
 */
const DESTINATIONS = [
    { path: '/world', label: 'Map', Icon: MapIcon, end: true },
    { path: '/world/clubs', label: 'Clubs', Icon: Shield },
    { path: '/world/opportunities', label: 'Jobs & volunteering', Icon: BriefcaseBusiness },
    { path: '/world/matches', label: 'Matches', Icon: CalendarDays },
    { path: '/world/tournaments', label: 'Tournaments', Icon: Trophy },
    { path: '/world/people', label: 'People', Icon: UsersRound },
];

/** World's own navigation, shared by every World page. Keeps the area and player context. */
export function WorldNav({ className }: { className?: string }) {
    const t = useWorldCopy();
    const { search } = useLocation();
    const current = new URLSearchParams(search);
    const carried = new URLSearchParams();
    for (const key of CARRIED) if (current.get(key)) carried.set(key, current.get(key)!);
    const suffix = carried.size ? `?${carried}` : '';
    return (
        <RouteTabs label={t('GrassKickZ World')} className={`gk-world-nav${className ? ` ${className}` : ''}`}
            items={DESTINATIONS.map(({ path, label, Icon, end }) => ({ to: `${path}${suffix}`, label: t(label), end, icon: <Icon aria-hidden="true" /> }))} />
    );
}
