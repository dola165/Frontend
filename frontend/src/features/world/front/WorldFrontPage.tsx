import { useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldChild } from '../players';
import { useWorldArea, useWorldCities, type WorldArea } from '../useWorldArea';
import { WorldSearch } from './WorldSearch';
import { AroundMapBlock, Field } from './FrontBlocks';
import { CustomizeOverview } from './CustomizeOverview';
import { fieldInfo, type FieldId } from './fields';
import { useOverviewLayout } from './useOverviewLayout';
import { useWorldAudience } from './audience';
import { roleInfo, type OverviewLayout } from './roles';
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

/**
 * GrassKickZ World's front page, the person's own: the area's map, tall and wide, with one field open beside
 * it, then the rest of their fields as the page scrolls. Search sits in the header. The person says who they
 * are (Customize), which decides the page they start with and the fields they are offered.
 */
export default function WorldFrontPage() {
    const t = useWorldCopy();
    const { area, setCity } = useWorldArea();
    const audience = useWorldAudience();
    const nearby = useNearbyPlaces(area);
    const { layout: saved, save } = useOverviewLayout(audience);
    // While customising, the page shows the draft; Save keeps it, Cancel goes back to the saved page.
    const [draft, setDraft] = useState<OverviewLayout | null>(null);
    const layout = draft ?? saved;
    // Lists that follow each other share rows; a card field (clubs) takes the page's width on its own.
    const rows = layout.fields.reduce<FieldId[][]>((all, id) => {
        const last = all[all.length - 1];
        if (fieldInfo(id).shape === 'list' && last && fieldInfo(last[0]).shape === 'list') last.push(id); else all.push([id]);
        return all;
    }, []);
    return (
        <div className="gk-world-front">
            <header className="gk-world-front__head">
                <div className="gk-world-front__titles">
                    <h1>{t('GrassKickZ World')}</h1>
                    <p>{t('Near {city}, set up for a {role}', { city: area.city, role: t(roleInfo(layout.role).label).toLowerCase() })}</p>
                </div>
                <WorldSearch />
                <div className="gk-world-front__context">
                    <ChildPicker /><AreaPicker area={area} onChange={setCity} />
                    <Button onClick={() => setDraft(saved)}><SlidersHorizontal aria-hidden="true" />{t('Customize')}</Button>
                </div>
            </header>
            <div className="gk-world-front__lead">
                <AroundMapBlock area={area} markers={nearby} />
                <div className="gk-world-front__side"><Field id={layout.side} area={area} markers={nearby} side /></div>
            </div>
            {rows.length > 0 && <div className="gk-world-front__fields">
                {rows.map(row => <div key={row.join()} className="gk-world-front__row">{row.map(id => <Field key={id} id={id} area={area} markers={nearby} />)}</div>)}
            </div>}
            {draft && <CustomizeOverview draft={draft} saved={saved} onChange={setDraft} onCancel={() => setDraft(null)} onSave={() => { save(draft); setDraft(null); }} />}
        </div>
    );
}
