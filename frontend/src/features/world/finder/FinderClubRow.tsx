import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { BadgeCheck, ChevronDown } from 'lucide-react';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Crest } from '../Crest';
import { fittingProgrammes, programmeFee, publicProgrammes } from '../cards/programmes';
import { clubTypeLabel, distanceLabel } from '../format';
import { keepPane } from '../peek/usePeek';
import { useWorldChild } from '../players';
import { useWorldCopy } from '../copy';
import { FinderClub } from './FinderClub';
import { parentGroupLabel, programmeBornYears } from './waysIn';

/**
 * A club as one line of the finder's list: its crest and name, where and how far, and the programme that fits the
 * child, by the club's name for it without its age code and the born years ("Foundation · born 2017–2020 · 120 GEL /
 * month"). Pressing it opens the club inside the list (World's own `selected`, so the map's pin and the line are one
 * choice), with the ways in, in place of a group a link opened above the list.
 */
export function FinderClubRow({ club, distanceKm }: { club: ClubProfile; distanceKm?: number }) {
    const copy = useJourneyCopy();
    const t = useWorldCopy();
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const { child } = useWorldChild();
    const open = params.get('selected') === String(club.id);
    // A club already open when the pop-up opens (a shared link, Back) is brought into view under the map.
    const row = useRef<HTMLLIElement>(null), openedWith = useRef(open);
    useEffect(() => { if (openedWith.current) row.current?.scrollIntoView({ block: 'start' }); }, []);
    const programmes = child ? fittingProgrammes(club.presentation, child) : publicProgrammes(club.presentation);
    const programme = programmes[0];
    const years = programme ? programmeBornYears(programme.ageMin, programme.ageMax) : null;
    const fact = programme ? [parentGroupLabel(copy, programme.name, years?.from, years?.to), programmeFee(programme)].filter(Boolean).join(' · ') : null;
    const toggle = () => setParams(current => {
        const next = new URLSearchParams(current);
        if (open) next.delete('selected'); else next.set('selected', String(club.id));
        next.delete('way');
        next.delete('group');
        return next;
    }, { replace: true, preventScrollReset: true, state: keepPane(location.state) });
    return <li ref={row} className="gk-finder-club" data-open={open || undefined} data-guide="club-row">
        <button type="button" className="gk-finder-club__head" aria-expanded={open} onClick={toggle}>
            <Crest src={club.logoUrl} name={club.name} size={40} />
            <span className="gk-finder-club__text">
                <strong>{club.name}{club.isOfficial && <BadgeCheck className="gk-world-verified" aria-label={t('Verified club')} />}</strong>
                <small>{[t(clubTypeLabel(club.type)), club.cityName || club.addressText?.split(',')[0]].filter(Boolean).join(' · ')}</small>
                {fact ? <small className="gk-finder-club__fits">{fact}</small> : child ? <small>{copy('Ask the club about a place', 'ჰკითხეთ კლუბს ადგილის შესახებ')}</small> : null}
            </span>
            {distanceKm != null && <span className="gk-finder-club__km">{distanceLabel(distanceKm)}</span>}
            <ChevronDown className="gk-finder-club__chevron" aria-hidden="true" />
        </button>
        {open && <FinderClub club={club} />}
    </li>;
}
