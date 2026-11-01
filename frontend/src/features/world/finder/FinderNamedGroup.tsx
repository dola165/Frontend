import { useLocation, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button, LoadFailed, Skeleton } from '../../../design/primitives';
import { fetchOpportunity } from '../../admissions/api';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { fetchClubProfile } from '../api';
import { Crest } from '../Crest';
import { keepPane } from '../peek/usePeek';
import { useWorldData } from '../useWorldData';
import { FinderClub } from './FinderClub';

/**
 * The group a link names (`group`: a shared link, an old group page), open with its club above the finder's list. Both
 * are loaded by their ids, so no filter, distance or page of the list hides them, and the group shows closed or full
 * too. ✕, or opening a club from the list, leaves the list on its own. The directory's slot above its results.
 */
export function FinderNamedGroup() {
    const [params] = useSearchParams();
    const id = Number(params.get('group'));
    return Number.isInteger(id) && id > 0 ? <Named key={id} groupId={id} /> : null;
}

function Named({ groupId }: { groupId: number }) {
    const copy = useJourneyCopy();
    const [, setParams] = useSearchParams();
    const location = useLocation();
    const group = useWorldData(`finder-group:${groupId}`, signal => fetchOpportunity(groupId, signal));
    const clubId = group.data?.clubId ?? null;
    const club = useWorldData(clubId ? `finder-club:${clubId}` : null, signal => fetchClubProfile(clubId!, signal));
    const close = () => setParams(current => { const next = new URLSearchParams(current); next.delete('group'); next.delete('way'); return next; },
        { replace: true, preventScrollReset: true, state: keepPane(location.state) });
    if (group.error || club.error) return <LoadFailed text={copy('Couldn’t open the group from the link', 'ბმულის ჯგუფი ვერ გაიხსნა')} retry={copy('Try again', 'ხელახლა ცდა')}
        onRetry={() => { if (group.error) group.retry(); else club.retry(); }} />;
    // A group outside a club (another kind of organisation) has no club to open here: the list stays on its own.
    if (group.data && !clubId) return null;
    if (!group.data || !club.data) return <Skeleton height={96} />;
    return <section className="gk-finder-club gk-finder-named" data-open aria-label={club.data.name} data-guide="named-group">
        <div className="gk-finder-club__head">
            <Crest src={club.data.logoUrl} name={club.data.name} size={40} />
            <span className="gk-finder-club__text"><strong>{club.data.name}</strong><small>{club.data.cityName || club.data.addressText?.split(',')[0]}</small></span>
            <Button size="sm" variant="ghost" aria-label={copy('Close this club', 'კლუბის დახურვა')} onClick={close}><X aria-hidden="true" /></Button>
        </div>
        <FinderClub club={club.data} named={group.data} />
    </section>;
}
