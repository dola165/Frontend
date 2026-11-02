import { useId } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useWorldCopy } from './copy';
import { useWorldChild } from './players';
import { ANYWHERE, useWorldArea, useWorldCities, type WorldArea } from './useWorldArea';
import { SquadSwitch } from './front/coach/SquadSwitch';
import { useWorldRole } from './front/useWorldRole';

/** The World tab the person is on: '' for the overview, otherwise "clubs", "matches"… */
const tabOf = (pathname: string) => pathname.replace(/^\/world\/?/, '').split('/')[0];
/**
 * Where each choice changes what is shown: the area, the chosen child, the coach's squads. A tab joins a set when
 * its lists use that choice; the bar never offers a choice that would change nothing.
 */
const AREA_TABS = new Set(['', 'clubs', 'opportunities', 'matches', 'tournaments', 'people']);
const CHILD_TABS = new Set(['', 'clubs', 'opportunities', 'matches', 'tournaments']);
const SQUAD_TABS = new Set(['clubs', 'matches', 'tournaments']);

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
            next.set('player', value || 'anyone');
            next.delete('birthYear');
            next.delete('for');
            ['selected', 'shown', 'peek', 'side'].forEach(key => next.delete(key));
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

function BirthYearPicker() {
    const t = useWorldCopy();
    const id = useId();
    const [params, setParams] = useSearchParams();
    const { child } = useWorldChild();
    const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Tbilisi' }).format(new Date()));
    if (child?.dateOfBirth) return null;
    return <label className="gk-world-area" htmlFor={id}><span className="gk-faint">{t('Birth year')}</span>
        <select id={id} aria-label={t('Birth year')} className="gk-input" value={params.get('birthYear') || ''} onChange={event => {
            const value = event.target.value;
            setParams(current => { const next = new URLSearchParams(current); if (value) next.set('birthYear', value); else next.delete('birthYear');
                next.set('player', 'anyone');
                ['for', 'selected', 'shown', 'peek', 'side'].forEach(key => next.delete(key)); return next; }, { replace: true });
        }}><option value="">{t('Anyone')}</option>{Array.from({ length: 80 }, (_, i) => year - i).map(value => <option key={value} value={value}>{value}</option>)}</select>
    </label>;
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
    const [params] = useSearchParams();
    const personal = tab === 'clubs' && params.get('view') === 'following' || tab === 'tournaments' && params.get('tab') === 'mine';
    const supportsFor = !personal && CHILD_TABS.has(tab) && !((tab === 'matches' || tab === '') && ['events', 'arrangements'].includes(params.get('tab') || ''));
    return (
        <div className="gk-world-context">
            {supportsFor && SQUAD_TABS.has(tab) && <SquadSwitch role={role} />}
            {supportsFor && <><ChildPicker /><BirthYearPicker /></>}
            {!personal && AREA_TABS.has(tab) && <AreaPicker area={area} onChange={setCity} anywhere={tab !== ''} />}
        </div>
    );
}
