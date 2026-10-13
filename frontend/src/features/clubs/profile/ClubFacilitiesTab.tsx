import { Fragment, useState } from 'react';
import { Building2, ChevronDown, MapPin, Navigation, Warehouse } from 'lucide-react';
import { MediaImage } from '../../../components/ui/MediaImage';
import { useClubProfileSearchParams } from '../clubProfilePreviewContext';
import { Button, EmptyNote, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import type { PublicFacility } from '../ClubPlaceCard';
import { placeType } from '../clubPlaceTypes';
import { FacilityDirectionsPanel } from '../FacilityDirectionsPanel';
import type { PublicSquad } from '../publicJourney';
import { useOverviewSource } from '../useOverviewSource';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { ClubProfile } from './types';

const groups = [
    { type: 'VENUE', title: 'Venues', hint: 'Where the club plays and trains', icon: Warehouse },
    { type: 'FACILITY', title: 'Facilities', hint: 'Gyms, changing rooms, medical rooms and the clubhouse', icon: Building2 },
    { type: 'UNCLASSIFIED', title: 'Other locations', hint: undefined, icon: MapPin },
] as const;
const addressOf = (place: PublicFacility) => place.details.address || (placeType(place) === 'VENUE' ? place.linkedVenue?.address : undefined);
function photoOf(place: PublicFacility) {
    const own = (place.details.photos ?? '').split(/\r?\n/).map(v => v.trim()).find(v => /^\/uploads\/[A-Za-z0-9_-]+\.jpg$/.test(v) || /^https:\/\//.test(v));
    return own ?? (placeType(place) === 'VENUE' ? place.linkedVenue?.photo : undefined) ?? null;
}

/** Where the club plays, trains and gathers: one line per place; pressing it opens its details under it, and Directions opens the club's own map. */
export function ClubFacilitiesTab({ club, canEdit }: { club: ClubProfile; canEdit: boolean }) {
    const [params, setParams] = useClubProfileSearchParams();
    const squad = params.get('squad') ?? '';
    // Several places can be open at once; a link from the left column opens one of them.
    const [open, setOpen] = useState<number[]>(() => { const id = Number(params.get('place')); return id > 0 ? [id] : []; });
    const [directions, setDirections] = useState<PublicFacility | null>(null);
    const places = useOverviewSource<PublicFacility[]>(`/clubs/${club.id}/facilities`);
    const squads = useOverviewSource<PublicSquad[]>(`/clubs/${club.id}/squads`);
    const set = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
    const filtered = (places.data ?? []).filter(f => !squad || f.squadId == null || String(f.squadId) === squad);
    const row = (place: PublicFacility, Icon: typeof MapPin) => {
        const photo = photoOf(place), address = addressOf(place), isOpen = open.includes(place.id);
        const amenities = (place.linkedVenue?.amenities ?? []).slice(0, 6).map(a => a.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase()));
        return <Fragment key={place.id}>
            <ListRow onClick={() => setOpen(ids => isOpen ? ids.filter(id => id !== place.id) : [...ids, place.id])} current={isOpen}
                lead={photo ? <span className="gk-avatar gk-avatar--square gk-club-place-photo"><MediaImage src={resolveMediaUrl(photo)} alt="" /></span> : <span className="gk-club-icon"><Icon aria-hidden="true" /></span>}
                title={place.title || 'Location'} meta={[address || 'Address not published', place.squadName || (place.squadId ? 'One squad' : 'Club-wide')].join(' · ')}
                trail={<ChevronDown aria-hidden="true" className={`gk-faint gk-club-place-chevron${isOpen ? ' is-open' : ''}`} size={16} />} />
            {isOpen && <li key={`${place.id}-details`} className="gk-club-place-detail">
                {place.details.description && <p>{place.details.description}</p>}
                {amenities.length > 0 && <p className="gk-muted">{amenities.join(' · ')}</p>}
                <button type="button" className="gk-btn gk-btn--secondary gk-btn--sm" onClick={() => setDirections(place)}><Navigation aria-hidden="true" />Directions</button>
            </li>}
        </Fragment>;
    };
    return <>
        {(squads.data?.length ?? 0) > 0 && <div className="gk-club-toolbar">
            <select className="gk-input gk-club-select" aria-label="Locations for a squad" value={squad} onChange={e => set('squad', e.target.value)}><option value="">All squads</option>{squads.data!.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            {squad && <span className="gk-muted">Includes club-wide grounds</span>}
            {canEdit && <a className="gk-section__action" href={`/clubs/${club.id}/workspace?tab=facilities`}>Manage locations</a>}
        </div>}
        {places.loading ? <Panel flush><div className="gk-panel--pad"><Skeleton height={48} /></div></Panel>
            : places.failed ? <Panel flush><EmptyNote title="The locations couldn’t load" action={<Button size="sm" onClick={places.retry}>Try again</Button>} /></Panel>
            : !filtered.length ? <Panel flush><EmptyNote title="No locations published yet">{squad ? 'No published location is assigned to this squad.' : 'Ask the club where it trains before your first visit.'}</EmptyNote></Panel>
            : groups.map(group => {
                const items = filtered.filter(p => placeType(p) === group.type);
                return items.length ? <Section key={group.type} boxed title={group.title} hint={group.hint}>
                    <Panel flush><List label={group.title}>{items.map(p => row(p, group.icon))}</List></Panel>
                </Section> : null;
            })}
        {directions && <FacilityDirectionsPanel clubId={club.id} facilityId={directions.id} title={directions.title} address={addressOf(directions)} onClose={() => setDirections(null)} />}
        <p className="gk-muted gk-club-note">Use the location confirmed for your session. A club’s postal address may differ from its training ground.</p>
    </>;
}
