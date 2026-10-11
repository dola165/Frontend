import { useId } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useWorldCopy } from './copy';
import { useWorldChild } from './players';
import { ANYWHERE, useWorldArea, useWorldCities, type WorldArea } from './useWorldArea';
import { SquadSwitch } from './front/coach/SquadSwitch';
import { useWorldRole } from './front/useOverviewLayout';

/** The World tab the person is on: '' for the overview, otherwise "clubs", "matches"… */
const tabOf = (pathname: string) => pathname.replace(/^\/world\/?/, '').split('/')[0];
/**
 * Where each choice changes what is shown: the area, the chosen child, the coach's squads. A tab joins a set when
 * its lists use that choice; the bar never offers a choice that would change nothing.
 */
const AREA_TABS = new Set(['', 'clubs']);
const CHILD_TABS = new Set(['', 'clubs']);
const SQUAD_TABS = new Set(['']);

/** Near: the area every World tab searches. Lists also offer "Anywhere"; the overview always needs a place. */
function AreaPicker({ area, onChange, anywhere }: { area: WorldArea; onChange: (city: string) => void; anywhere: boolean }) {
    const t = useWorldCopy();
    const id = useId();
    const cities = useWorldCities();
    const options = cities.includes(area.city) ? cities : [area.city, ...cities];
    const value = anywhere && area.anywhere ? ANYWHERE : area.city;
    return (
        <label className="gk-world-area" htmlFor={id}>
            <span className="gk-faint">{t('Near')}</span>
            <select id={id} className="gk-input" value={value} onChange={event => onChange(event.target.value)}>
                {options.map(city => <option key={city} value={city}>{city}</option>)}
                {anywhere && <option value={ANYWHERE}>{t('Anywhere')}</option>}
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
 * Who and where World is for, beside its navigation on every tab: the coach's squads or the parent's child
 * (only on tabs where that changes what is shown) and the area. Choices are kept in the address and follow
 * the person from tab to tab.
 */
export function WorldContextBar() {
    const { pathname } = useLocation();
    const role = useWorldRole();
    const { area, setCity } = useWorldArea();
    const tab = tabOf(pathname);
    return (
        <div className="gk-world-context">
            {SQUAD_TABS.has(tab) && <SquadSwitch role={role} />}
            {CHILD_TABS.has(tab) && <ChildPicker />}
            {AREA_TABS.has(tab) && <AreaPicker area={area} onChange={setCity} anywhere={tab !== ''} />}
        </div>
    );
}
