import { useMatchCopy } from '../copy';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Badge, Button, Skeleton } from '../../../design/primitives';
import { ChoiceChips } from '../../../design/ChoiceChips';
import { Combobox } from '../../../design/Combobox';
import { useSearch } from '../../../design/useSearch';
import { searchVenues, type Ground } from './api';
import { groundHosts, groundLocation, hostingOf, type GroundChoice, type Hosting, type Mode } from './matchPlan';

const PinPicker = lazy(() => import('./PinPicker'));
interface Load<T> { data: T | undefined; loading: boolean; error: string; retry: () => void }

const choiceKey = (value: GroundChoice) => value.kind === 'OURS' || value.kind === 'THEIRS' ? `${value.kind}:${value.ground.key}` : value.kind;

function Option({ id, checked, onSelect, title, detail, badge, children }: { id: string; checked: boolean; onSelect: () => void; title: ReactNode; detail?: ReactNode; badge?: ReactNode; children?: ReactNode }) {
    return (
        <li className="gk-arrange__ground" data-checked={checked || undefined}>
            <label className="gk-arrange__ground-row" htmlFor={id}>
                <input id={id} type="radio" name="arrange-ground" checked={checked} onChange={onSelect} />
                <span className="gk-arrange__option-text"><strong>{title}</strong>{detail && <span>{detail}</span>}</span>
                {badge}
            </label>
            {checked && children && <div className="gk-arrange__ground-more">{children}</div>}
        </li>
    );
}

/**
 * Where the match is played: one of our grounds, theirs, at their ground still to be named, any venue on GrassKickZ, a
 * pin on the map, or to be arranged. At a club's ground hosting follows from it; anywhere else the person says who hosts
 * (we host, they host, neutral, to agree). Choosing a ground never books or rents it; rentals are for training.
 */
export function GroundField({ mode, value, hosting, onChange, onHosting, ours, theirs, opponentName, opponentCity, defaultCity, error }: {
    mode: Mode; value: GroundChoice; hosting?: Hosting | null; onChange: (value: GroundChoice) => void; onHosting: (value: Hosting) => void;
    ours: Load<Ground[]>; theirs: Load<Ground[]> | null; opponentName?: string; /** At their ground starts in their city. */ opponentCity?: string | null; defaultCity: string; error?: string;
}) {
    const t = useMatchCopy();
    const [query, setQuery] = useState('');
    const venues = useSearch(query, (q, signal) => searchVenues(q, signal));
    const current = choiceKey(value);
    // The city typed for this choice; a new choice starts from it, else from our club's city.
    const city = 'city' in value ? value.city ?? '' : '';
    const startCity = city || defaultCity;
    const detail = (text: string) => text.split(' · ').map(part => t(part)).join(' · ');
    const cityInput = (id: string) => (
        <div className="gk-field">
            <label className="gk-field__label" htmlFor={id}>{t("City")}</label>
            <input id={id} className="gk-input" maxLength={120} value={city} onChange={event => onChange({ ...value, city: event.target.value } as GroundChoice)} />
        </div>
    );
    // A listed ground with no city on record asks for one under it (the server needs it).
    const missingCity = (id: string) => (value.kind === 'OURS' || value.kind === 'THEIRS' || value.kind === 'OTHER') && value.ground && !value.ground.city?.trim() ? cityInput(id) : null;
    const travel = mode === 'open' ? { title: t("We travel to the opponent"), detail: t("The team you choose hosts the match") }
        : { title: opponentName ? t('At {club}’s ground', { club: opponentName }) : t('At their ground'), detail: t("They host and name the ground") };
    return (
        <fieldset className="gk-arrange__fieldset" aria-describedby={error ? 'arrange-ground-error' : 'arrange-ground-hint'}>
            <legend className="gk-field__label">{t("Ground")}</legend>
            <ul className="gk-arrange__grounds">
                {ours.loading && <li className="gk-arrange__ground"><Skeleton height={44} /></li>}
                {ours.data?.map(ground => <Option key={ground.key} id={`arrange-ground-ours-${ground.key}`} checked={current === `OURS:${ground.key}`}
                    onSelect={() => onChange({ kind: 'OURS', ground })} title={ground.name} detail={detail(ground.detail)} badge={<Badge tone="accent">{t("You host")}</Badge>}>{missingCity(`arrange-ground-city-${ground.key}`)}</Option>)}
                {theirs?.loading && <li className="gk-arrange__ground"><Skeleton height={44} /></li>}
                {theirs?.data?.map(ground => <Option key={ground.key} id={`arrange-ground-theirs-${ground.key}`} checked={current === `THEIRS:${ground.key}`}
                    onSelect={() => onChange({ kind: 'THEIRS', ground })} title={ground.name} detail={[opponentName ? t('{club} ground', { club: opponentName }) : t('Their ground'), detail(ground.detail)].filter(Boolean).join(' · ')} badge={<Badge tone="info">{t("You travel")}</Badge>}>{missingCity(`arrange-ground-city-${ground.key}`)}</Option>)}
                <Option id="arrange-ground-travel" checked={current === 'TRAVEL'} onSelect={() => onChange({ kind: 'TRAVEL', city: (mode !== 'open' && opponentCity) || startCity })}
                    title={travel.title} detail={travel.detail} badge={<Badge tone="info">{t("You travel")}</Badge>}>{cityInput('arrange-travel-city')}</Option>
                <Option id="arrange-ground-other" checked={current === 'OTHER'} onSelect={() => onChange({ kind: 'OTHER', ground: null })}
                    title={t("Another venue on GrassKickZ")} detail={value.kind === 'OTHER' && value.ground ? [value.ground.name, groundLocation(value).city].filter(Boolean).join(' · ') : t("A neutral ground or a venue another club uses")}>
                    {value.kind === 'OTHER' && value.ground
                        ? <><div className="gk-arrange__picked"><span className="gk-arrange__option-text"><strong>{value.ground.name}</strong><span>{detail(value.ground.detail || value.ground.city)}</span></span>
                            <Button size="sm" variant="ghost" onClick={() => onChange({ kind: 'OTHER', ground: null })}>{t('Change')}</Button></div>{missingCity('arrange-other-city')}</>
                        : <Combobox label={t("Venues")} query={query} onQuery={setQuery} items={venues.items} itemKey={venue => venue.key} status={venues.status}
                            loadingText={t('Searching…')} placeholder={t("Search venues by name or area")} emptyText={t("No venue matches that search. Drop a pin instead.")} errorText={t("Venue search is unavailable. Drop a pin instead.")}
                            renderItem={venue => <span className="gk-arrange__option-text"><strong>{venue.name}</strong><span>{[venue.detail, venue.city].filter(Boolean).join(' · ')}</span></span>}
                            onSelect={venue => { onChange({ kind: 'OTHER', ground: venue }); setQuery(''); }} />}
                </Option>
                <Option id="arrange-ground-pin" checked={current === 'PIN'} onSelect={() => onChange({ kind: 'PIN', name: '', city: startCity, latitude: '', longitude: '' })}
                    title={t("A ground that isn’t listed")} detail={t('Drop a pin on the map')}>
                    {value.kind === 'PIN' && <>
                        <div className="gk-arrange__kickoff">
                            <div className="gk-field">
                                <label className="gk-field__label" htmlFor="arrange-pin-name">{t("Ground name")}</label>
                                <input id="arrange-pin-name" className="gk-input" maxLength={255} value={value.name} placeholder={t("For example, School No. 51 pitch")} onChange={event => onChange({ ...value, name: event.target.value })} />
                            </div>
                            {cityInput('arrange-pin-city')}
                        </div>
                        <Suspense fallback={<Skeleton height={260} />}><PinPicker latitude={value.latitude} longitude={value.longitude} onChange={(latitude, longitude) => onChange({ ...value, latitude, longitude })} /></Suspense>
                    </>}
                </Option>
                <Option id="arrange-ground-later" checked={current === 'LATER'} onSelect={() => onChange({ kind: 'LATER', city: startCity })}
                    title={t("To be arranged")} detail={mode === 'direct' ? t("Agree the ground with them after they accept") : t("Agree the ground later")}>{cityInput('arrange-later-city')}</Option>
            </ul>
            {!groundHosts(value) && <div className="gk-field">
                <span className="gk-field__label" id="arrange-hosting-label">{t("Who hosts")}</span>
                <ChoiceChips labelledBy="arrange-hosting-label" value={hostingOf({ ground: value, hosting })} onChange={onHosting}
                    choices={[{ value: 'HOME' as const, label: t("We host") }, { value: 'AWAY' as const, label: t("They host") }, { value: 'NEUTRAL' as const, label: t("Neutral") }, { value: 'FLEXIBLE' as const, label: t("To agree") }]} />
            </div>}
            {ours.error && <p className="gk-notice gk-notice--warning" role="status">{t("Your club’s grounds could not load.")}{' '}<Button size="sm" onClick={ours.retry}>{t("Try again")}</Button></p>}
            {theirs?.error && <p className="gk-notice gk-notice--warning" role="status">{opponentName ? t('{club} grounds could not load.', { club: opponentName }) : t('Their grounds could not load.')} <Button size="sm" onClick={theirs.retry}>{t("Try again")}</Button></p>}
            {error ? <span id="arrange-ground-error" className="gk-field__error" role="alert">{t(error)}</span>
                : <span id="arrange-ground-hint" className="gk-field__hint">{t("Choosing a ground doesn’t book it. Confirm the time with whoever runs it.")}</span>}
        </fieldset>
    );
}
