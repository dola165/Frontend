import { useLocation } from 'react-router-dom';
import { BriefcaseBusiness, CalendarDays, Compass, LandPlot, Map as MapIcon, Shield, Trophy, UsersRound } from 'lucide-react';
import { RouteTabs } from '../../design/Tabs';

const DESTINATIONS = [
    { path: '/world', label: 'Overview', Icon: Compass, end: true },
    { path: '/world/clubs', label: 'Clubs', Icon: Shield },
    { path: '/world/people', label: 'People', Icon: UsersRound },
    { path: '/world/venues', label: 'Venues', Icon: LandPlot },
    { path: '/world/matches', label: 'Matches', Icon: CalendarDays },
    { path: '/world/competitions', label: 'Competitions', Icon: Trophy },
    { path: '/world/opportunities', label: 'Opportunities', Icon: BriefcaseBusiness },
    { path: '/world/map', label: 'Map', Icon: MapIcon },
];

/** World's own navigation, shared by every World page. Keeps the area and player context. */
export function WorldNav({ className }: { className?: string }) {
    const { search } = useLocation();
    const current = new URLSearchParams(search);
    const carried = new URLSearchParams();
    for (const key of ['near', 'player']) if (current.get(key)) carried.set(key, current.get(key)!);
    const suffix = carried.size ? `?${carried}` : '';
    return (
        <RouteTabs label="GrassKickZ World" className={`gk-world-nav${className ? ` ${className}` : ''}`}
            items={DESTINATIONS.map(({ path, label, Icon, end }) => ({ to: `${path}${suffix}`, label, end, icon: <Icon aria-hidden="true" /> }))} />
    );
}
