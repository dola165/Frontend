import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldChild } from '../players';
import { useWorldArea, useWorldCities, type WorldArea } from '../useWorldArea';
import { WorldSearch } from './WorldSearch';
import { AroundMapBlock, ClubsTile, ComingUpTile, CompetitionsTile, OpenMatchesTile, OpportunitiesTile, PeopleTile, VenuesTile } from './FrontBlocks';
import { useWorldAudience, type WorldAudience } from './audience';
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
function QuickStarts({ city, audience }: { city: string; audience: WorldAudience }) {
    const t = useWorldCopy();
    const { children, child } = useWorldChild();
    return (
        <nav className="gk-world-starts" aria-label={t('Start with')}>
            {quickStarts(city, audience, children, child).map(start => <Link key={start.to} className="gk-chip" to={start.to}>{t(start.label, { name: start.name ?? '' })}</Link>)}
        </nav>
    );
}

type TileId = 'matches' | 'events' | 'competitions' | 'people' | 'venues' | 'jobs' | 'clubs';
/** Each audience gets its own tiles, most useful first. A coach looks for opponents, fixtures, competitions, officials and pitches. */
const TILES: Record<WorldAudience, TileId[]> = {
    coach: ['matches', 'events', 'competitions', 'people', 'venues', 'jobs', 'clubs'],
    parent: ['clubs', 'jobs', 'events', 'venues', 'competitions', 'people'],
    member: ['events', 'clubs', 'jobs', 'competitions', 'people', 'venues'],
};

/**
 * GrassKickZ World's front page: search and entry points, then the map of the area beside folded tiles.
 * Each tile says what exists (a picture, a count, the next item) and opens in place to list it; the open
 * tile is kept in the URL (`open`).
 */
export default function WorldFrontPage() {
    const t = useWorldCopy();
    const { area, setCity } = useWorldArea();
    const audience = useWorldAudience();
    const nearby = useNearbyPlaces(area);
    const [params, setParams] = useSearchParams();
    const opened = params.get('open');
    const toggle = (id: TileId) => setParams(current => {
        const next = new URLSearchParams(current);
        if (next.get('open') === id) next.delete('open'); else next.set('open', id);
        return next;
    }, { replace: true, preventScrollReset: true });
    const tile = (id: TileId) => {
        const props = { area, open: opened === id, onToggle: () => toggle(id) };
        switch (id) {
            case 'matches': return <OpenMatchesTile key={id} {...props} />;
            case 'events': return <ComingUpTile key={id} {...props} />;
            case 'competitions': return <CompetitionsTile key={id} {...props} />;
            case 'people': return <PeopleTile key={id} {...props} />;
            case 'venues': return <VenuesTile key={id} {...props} markers={nearby} />;
            case 'jobs': return <OpportunitiesTile key={id} {...props} />;
            case 'clubs': return <ClubsTile key={id} {...props} markers={nearby} />;
        }
    };
    return (
        <div className="gk-world-front">
            <PageHeader
                title={t('GrassKickZ World')}
                subtitle={t('Clubs, people, pitches and matches near {city}.', { city: area.city })}
                actions={<div className="gk-world-front__context"><ChildPicker /><AreaPicker area={area} onChange={setCity} /></div>}
            />
            <WorldSearch quickStarts={<QuickStarts city={area.city} audience={audience} />} />
            <div className="gk-world-front__lead">
                <AroundMapBlock area={area} markers={nearby} />
                <div className="gk-world-front__tiles">{TILES[audience].map(tile)}</div>
            </div>
        </div>
    );
}
