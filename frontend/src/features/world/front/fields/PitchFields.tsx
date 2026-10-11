import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChoiceChips } from '../../../../design/ChoiceChips';
import { EmptyNote } from '../../../../design/primitives';
import { formats, surfaces } from '../../../venues/api';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { isoDay } from '../../format';
import { usePitchSlots, type VenueSlots } from '../coach/coachPlaces';
import { COACHING_ROLES, useSquadFocus } from '../coach/mySquads';
import { SlotChips } from '../coach/SlotChips';
import { WorldField } from '../WorldField';
import type { FieldId } from '../fields';
import type { FieldProps } from './fieldProps';
import '../coach/coach.css';

const SHOWN = 6;
const EVENINGS = { from: '17:00', to: '21:00' };
const ALL_DAY = { from: '07:00', to: '22:00' };

/** "7-a-side · Artificial grass · from 80 GEL/h · 2.1 km" for the pitches that suit. */
function venueFacts(entry: VenueSlots, t: ReturnType<typeof useWorldCopy>) {
    const kinds = [...new Set(entry.pitches.map(pitch => formats[pitch.format] ?? pitch.format))].join(', ');
    const ground = [...new Set(entry.pitches.map(pitch => surfaces[pitch.surface] ?? pitch.surface))].join(', ');
    const price = Math.min(...entry.pitches.map(pitch => pitch.pricePerHour));
    return [kinds, ground, t('from {price} {currency}/h', { price, currency: entry.venue.currency }), entry.km != null ? `${entry.km < 10 ? entry.km.toFixed(1) : Math.round(entry.km)} km` : null].filter(Boolean).join(' · ');
}

/**
 * Free slots at the nearest pitches, one tap from booking. Coaching staff see evenings this week for their squads'
 * size, with the slot length (60 or 90 minutes) kept in the URL; everyone else the next free hour today or tomorrow.
 * Indoor keeps covered pitches only.
 */
function Pitches({ id, area, side, role }: FieldProps & { id: FieldId }) {
    const t = useWorldCopy();
    const lengthId = useId();
    const coach = COACHING_ROLES.has(role);
    const focus = useSquadFocus(role);
    const [params, setParams] = useSearchParams();
    const minutes = coach ? (params.get('slot') === '60' ? 60 : 90) : 60;
    const smallestSide = coach && focus.focus.length ? Math.min(...focus.focus.map(squad => squad.sideSize)) : 5;
    const data = usePitchSlots(area, { indoor: id === 'indoorPitches', minutes, smallestSide, window: coach ? EVENINGS : ALL_DAY, wait: coach && focus.status === 'loading' });
    const soon = coach ? null : isoDay(1);
    const venues = (data.data ?? []).map(entry => ({ ...entry, slots: soon ? entry.slots.filter(slot => slot.date <= soon) : entry.slots }));
    const free = venues.reduce((sum, entry) => sum + entry.slots.length, 0);
    const setLength = (value: number) => setParams(current => { const next = new URLSearchParams(current); if (value === 90) next.delete('slot'); else next.set('slot', String(value)); return next; }, { replace: true, preventScrollReset: true });
    const title = coach ? undefined : id === 'indoorPitches' ? t('Indoor pitches free today') : t('Pitches free today');
    return (
        <WorldField id={id} title={title} side={side} loading={data.loading || (coach && focus.status === 'loading')} error={data.error} onRetry={data.retry}
            hint={data.data && !free ? t('Nothing free') : coach ? t('Evenings this week · {minutes} min', { minutes }) : t('Today and tomorrow · 1 hour')}
            all={{ label: t('All pitches'), to: `/world/venues${id === 'indoorPitches' ? '?covered=true' : ''}` }}>
            {coach && <div className="gk-pitches__length"><span id={lengthId}>{t('Slot')}</span>
                <ChoiceChips labelledBy={lengthId} value={minutes} onChange={setLength} choices={[{ value: 60, label: t('60 min') }, { value: 90, label: t('90 min') }]} /></div>}
            {venues.length ? <ul className="gk-pitches">
                {venues.map(entry => {
                    const pitchName = (pitchId: number) => entry.pitches.find(pitch => pitch.id === pitchId)?.name ?? '';
                    return <li key={entry.venue.id}>
                        <Link className="gk-pitches__venue" to={`/stadiums/${entry.venue.id}`}>
                            <Crest src={entry.venue.photos[0]?.url ?? entry.venue.logoUrl} name={entry.venue.displayName} size={36} />
                            <span className="gk-sb__main"><strong>{entry.venue.displayName}</strong><small>{venueFacts(entry, t)}</small></span>
                        </Link>
                        {entry.slots.length ? <SlotChips venueId={entry.venue.id} venueName={entry.venue.displayName} slots={entry.slots.slice(0, SHOWN)} timeZone={entry.timeZone} pitchName={pitchName} currency={entry.venue.currency}
                            more={{ count: entry.slots.length - SHOWN, to: `/stadiums/${entry.venue.id}` }} />
                            : <span className="gk-pitches__none">{coach ? t('No free evening this week') : t('Nothing free today or tomorrow')}</span>}
                    </li>;
                })}
            </ul> : <EmptyNote title={t('No pitches listed near {city}', { city: area.city })} />}
        </WorldField>
    );
}

export const FreePitchesField = (props: FieldProps) => <Pitches {...props} id="freePitches" />;
export const IndoorPitchesField = (props: FieldProps) => <Pitches {...props} id="indoorPitches" />;
