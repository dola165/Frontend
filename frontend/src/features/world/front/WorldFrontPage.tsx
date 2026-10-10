import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldChild } from '../players';
import { useWorldArea, useWorldCities, type WorldArea } from '../useWorldArea';
import { WorldSearch } from './WorldSearch';
import { AroundMapBlock, NearbyClubsBlock, OpenCompetitionsBlock, OpportunitiesBlock, PeopleBlock, WeekendBlock } from './FrontBlocks';
import { quickStarts } from './quickStarts';
import { useNearbyPlaces } from './useNearbyPlaces';
import './front.css';

function AreaPicker({ area, onChange }: { area: WorldArea; onChange: (city: string) => void }) {
    const t = useWorldCopy();
    const id = useId();
    const cities = useWorldCities();
    const options = cities.includes(area.city) ? cities : [area.city, ...cities];
    return (
        <label className="gk-world-area" htmlFor={id}>
            <span className="gk-faint">{t('Near')}</span>
            <select id={id} className="gk-input" value={area.city} onChange={event => onChange(event.target.value)}>
                {options.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
        </label>
    );
}

/** For a parent: which child World is searching for. The choice follows them to every World page. */
function ChildPicker() {
    const t = useWorldCopy();
    const id = useId();
    const { children, child, remember } = useWorldChild();
    const [, setParams] = useSearchParams();
    if (!children.length) return null;
    const choose = (value: string) => {
        remember.write(value);
        setParams(current => {
            const next = new URLSearchParams(current);
            if (value) next.set('player', value); else next.delete('player');
            return next;
        }, { replace: true, preventScrollReset: true });
    };
    return (
        <label className="gk-world-area" htmlFor={id}>
            <span className="gk-faint">{t('For')}</span>
            <select id={id} className="gk-input" value={child ? String(child.id) : ''} onChange={event => choose(event.target.value)}>
                <option value="">{t('Anyone')}</option>
                {children.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
        </label>
    );
}

/** Entry points by intent, each a directory with its tab and filters already chosen. */
function QuickStarts({ city }: { city: string }) {
    const t = useWorldCopy();
    const { children, child } = useWorldChild();
    return (
        <nav className="gk-world-starts" aria-label={t('Start with')}>
            {quickStarts(city, children, child).map(start => <Link key={start.to} className="gk-chip" to={start.to}>{t(start.label, { name: start.name ?? '' })}</Link>)}
        </nav>
    );
}

/** GrassKickZ World's front page: search and entry points, then what's on and who's around. */
export default function WorldFrontPage() {
    const t = useWorldCopy();
    const { area, setCity } = useWorldArea();
    const nearby = useNearbyPlaces(area);
    return (
        <div className="gk-world-front">
            <PageHeader
                title={t('GrassKickZ World')}
                subtitle={t('Clubs, people, pitches and matches near {city}.', { city: area.city })}
                actions={<div className="gk-world-front__context"><ChildPicker /><AreaPicker area={area} onChange={setCity} /></div>}
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
