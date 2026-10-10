import { useId } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../design/primitives';
import { useWorldArea, useWorldCities, type WorldArea } from '../useWorldArea';
import { WorldSearch } from './WorldSearch';
import { AroundMapBlock, NearbyClubsBlock, OpenCompetitionsBlock, OpportunitiesBlock, PeopleBlock, WeekendBlock } from './FrontBlocks';
import { useNearbyPlaces } from './useNearbyPlaces';
import './front.css';

function AreaPicker({ area, onChange }: { area: WorldArea; onChange: (city: string) => void }) {
    const id = useId();
    const cities = useWorldCities();
    const options = cities.includes(area.city) ? cities : [area.city, ...cities];
    return (
        <label className="gk-world-area" htmlFor={id}>
            <span className="gk-faint">Near</span>
            <select id={id} className="gk-input" value={area.city} onChange={event => onChange(event.target.value)}>
                {options.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
        </label>
    );
}

/** Entry points by intent, each a directory with filters already chosen. */
function QuickStarts({ city }: { city: string }) {
    const near = encodeURIComponent(city);
    const starts = [
        { label: 'Clubs with open trials', to: `/world/clubs?joinPolicy=OPEN_TRIAL&city=${near}` },
        { label: 'Academies', to: '/world/clubs?type=ACADEMY' },
        { label: 'Football for girls', to: '/world/opportunities?tab=groups&gender=FEMALE' },
        { label: 'Teams looking for a match', to: '/world/matches?tab=exchange' },
        { label: 'Referees', to: '/world/people?role=REFEREE' },
        { label: 'Coaching jobs', to: '/world/opportunities?category=COACHING' },
        { label: 'Volunteering', to: '/world/opportunities?engagement=VOLUNTEER' },
        { label: 'Pitches to hire', to: `/world/venues?city=${near}` },
    ];
    return (
        <nav className="gk-world-starts" aria-label="Start with">
            {starts.map(start => <Link key={start.label} className="gk-chip" to={start.to}>{start.label}</Link>)}
        </nav>
    );
}

/** GrassKickZ World's front page: search and entry points, then what's on and who's around. */
export default function WorldFrontPage() {
    const { area, setCity } = useWorldArea();
    const nearby = useNearbyPlaces(area);
    return (
        <div className="gk-world-front">
            <PageHeader
                title="GrassKickZ World"
                subtitle={`Clubs, people, pitches and matches near ${area.city}.`}
                actions={<AreaPicker area={area} onChange={setCity} />}
            />
            <WorldSearch quickStarts={<QuickStarts city={area.city} />} />
            <div className="gk-world-front__lead">
                <WeekendBlock area={area} />
                <AroundMapBlock area={area} markers={nearby} />
            </div>
            <NearbyClubsBlock area={area} markers={nearby} />
            <div className="gk-world-front__trio">
                <OpenCompetitionsBlock />
                <OpportunitiesBlock area={area} />
                <PeopleBlock area={area} />
            </div>
        </div>
    );
}
