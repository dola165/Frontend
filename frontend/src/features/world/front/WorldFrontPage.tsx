import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { Button, PageHeader } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldChild } from '../players';
import { useWorldArea, useWorldCities, type WorldArea } from '../useWorldArea';
import { WorldSearch } from './WorldSearch';
import { AroundMapBlock, Field } from './FrontBlocks';
import { CustomizeOverview } from './CustomizeOverview';
import { fieldInfo, type FieldId } from './fields';
import { useOverviewLayout } from './useOverviewLayout';
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

/**
 * GrassKickZ World's front page, the person's own: search and entry points, then the area's map with one
 * field open beside it, then the rest of their fields as the page scrolls. Each person chooses the fields
 * and their order (Customize); a coach starts from five or six that suit most coaches.
 */
export default function WorldFrontPage() {
    const t = useWorldCopy();
    const { area, setCity } = useWorldArea();
    const audience = useWorldAudience();
    const nearby = useNearbyPlaces(area);
    const { layout, save, reset, customised } = useOverviewLayout(audience);
    const [customizing, setCustomizing] = useState(false);
    // Lists that follow each other share rows; a card field (clubs) takes the page's width on its own.
    const rows = layout.fields.reduce<FieldId[][]>((all, id) => {
        const last = all[all.length - 1];
        if (fieldInfo(id).shape === 'list' && last && fieldInfo(last[0]).shape === 'list') last.push(id); else all.push([id]);
        return all;
    }, []);
    return (
        <div className="gk-world-front">
            <PageHeader
                title={t('GrassKickZ World')}
                subtitle={t('Clubs, people, pitches and matches near {city}.', { city: area.city })}
                actions={<div className="gk-world-front__context"><ChildPicker /><AreaPicker area={area} onChange={setCity} />
                    <Button onClick={() => setCustomizing(true)}><SlidersHorizontal aria-hidden="true" />{t('Customize')}</Button></div>}
            />
            <WorldSearch quickStarts={<QuickStarts city={area.city} audience={audience} />} />
            <div className="gk-world-front__lead">
                <AroundMapBlock area={area} markers={nearby} />
                <div className="gk-world-front__side"><Field id={layout.side} area={area} markers={nearby} side /></div>
            </div>
            {rows.length > 0 && <div className="gk-world-front__fields">
                {rows.map(row => <div key={row.join()} className="gk-world-front__row">{row.map(id => <Field key={id} id={id} area={area} markers={nearby} />)}</div>)}
            </div>}
            {customizing && <CustomizeOverview audience={audience} layout={layout} customised={customised} onChange={save} onReset={reset} onClose={() => setCustomizing(false)} />}
        </div>
    );
}
