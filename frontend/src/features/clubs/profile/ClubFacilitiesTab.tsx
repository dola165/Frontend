import { useClubProfileSearchParams } from '../clubProfilePreviewContext';
import { Button, EmptyNote, Panel, Section, Skeleton } from '../../../design/primitives';
import { FacilityCard, type PublicFacility } from '../ClubPlaceCard';
import { placeType } from '../clubPlaceTypes';
import type { PublicSquad } from '../publicJourney';
import { useOverviewSource } from '../useOverviewSource';
import { usePagesCopy } from '../../pages/copy';
import type { ClubProfile } from './types';

const groups = [
    { type: 'VENUE', title: 'Grounds', hint: 'Where the club plays and trains' },
    { type: 'FACILITY', title: 'Facilities', hint: 'Gyms, changing rooms, medical rooms and the clubhouse' },
    { type: 'UNCLASSIFIED', title: 'Other locations' },
] as const;

/** Reuse the established cards, including the same location details and directions. */
export function ClubFacilitiesTab({ club, canEdit }: { club: ClubProfile; canEdit: boolean }) {
    const t = usePagesCopy();
    const [params, setParams] = useClubProfileSearchParams();
    const squad = params.get('squad') ?? '';
    const places = useOverviewSource<PublicFacility[]>(`/clubs/${club.id}/facilities`);
    const squads = useOverviewSource<PublicSquad[]>(`/clubs/${club.id}/squads`);
    const set = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        setParams(next, { replace: true });
    };
    const filtered = (places.data ?? []).filter(f => !squad || f.squadId == null || String(f.squadId) === squad);
    return <>
        {((squads.data?.length ?? 0) > 0 || squad || canEdit) && <div className="gk-club-toolbar">
            {((squads.data?.length ?? 0) > 0 || squad) && <select className="gk-input gk-club-select" aria-label={t('Locations for a squad')} value={squad} onChange={e => set('squad', e.target.value)}>
                <option value="">{t('All squads')}</option>
                {squad && !squads.data?.some(s => String(s.id) === squad) && <option value={squad}>{t('Selected squad')}</option>}
                {squads.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>}
            {squad && <span className="gk-muted">{t('Includes club-wide grounds')}</span>}
            {canEdit && <a className="gk-section__action" href={`/clubs/${club.id}?edit=1&panel=grounds`}>{t('Manage locations')}</a>}
        </div>}
        {places.loading ? <Panel flush><div className="gk-panel--pad"><Skeleton height={160} /></div></Panel>
            : places.failed ? <Panel flush><EmptyNote title={t('The locations couldn’t load')} action={<Button size="sm" onClick={places.retry}>{t('Try again')}</Button>} /></Panel>
            : !filtered.length ? <Panel flush><EmptyNote title={t('No locations published yet')}>{t(squad ? 'No published location is assigned to this squad.' : 'Ask the club where it trains before your first visit.')}</EmptyNote></Panel>
            : groups.map(group => {
                const items = filtered.filter(p => placeType(p) === group.type);
                return items.length ? <Section key={group.type} boxed title={t(group.title)} hint={'hint' in group ? t(group.hint) : undefined}>
                    <div className="club-places-grid gk-club-places">{items.map(place => <FacilityCard key={place.id} facility={place} clubId={club.id} showVenueLinks={false} detailsOpen={params.get('place') === String(place.id)} onDetailsChange={open => set('place', open ? String(place.id) : '')} />)}</div>
                </Section> : null;
            })}
        <p className="gk-muted gk-club-note">{t('Use the location confirmed for your session. A club’s postal address may differ from its training ground.')}</p>
    </>;
}
