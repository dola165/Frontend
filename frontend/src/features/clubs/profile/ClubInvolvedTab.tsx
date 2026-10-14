import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { ClubStorePage } from '../../../pages/ClubStorePage';
import { ClubFundraisingPage } from '../../../pages/ClubFundraisingPage';
import { JobsDirectoryPage } from '../../../pages/JobsDirectoryPage';
import { involvedKindFrom, type InvolvedKind } from './clubTabs';
import type { ClubProfile } from './types';

const kinds: Array<{ id: InvolvedKind; label: string; all: string; global: string }> = [
    { id: 'store', label: 'Club store', all: 'All stores', global: '/store' },
    { id: 'jobs', label: 'Club jobs', all: 'All jobs', global: '/jobs' },
    { id: 'fundraising', label: 'Club fundraising', all: 'All fundraising', global: '/campaigns' },
];

/**
 * The club's store, jobs and fundraising in full, inside the club page: one line switches between the three,
 * and each has its global counterpart one press away. The pages read the club from the address, as on their own routes.
 */
export function ClubInvolvedTab({ club }: { club: ClubProfile }) {
    const [params, setParams] = useSearchParams();
    const kind = involvedKindFrom(params);
    const current = kinds.find(k => k.id === kind) ?? kinds[0];
    const show = (next: InvolvedKind) => {
        const query = new URLSearchParams();
        for (const key of ['player', 'manageClub', 'managementTab', 'debug']) if (params.has(key)) query.set(key, params.get(key)!);
        query.set('tab', 'involved');
        if (next !== 'store') query.set('show', next);
        setParams(query, { replace: true });
    };
    return <div className="gk-club-involved">
        <div className="gk-club-involved__bar">
            <div className="gk-chips" role="group" aria-label="Get involved">{kinds.map(k => <button key={k.id} type="button" className="gk-chip gk-club-involved__chip" data-kind={k.id} aria-pressed={k.id === kind} onClick={() => show(k.id)}>{k.label}</button>)}</div>
            <Link className="gk-section__action gk-row" to={current.global}>{current.all}<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
        {kind === 'store' && <ClubStorePage />}
        {kind === 'jobs' && <JobsDirectoryPage fixedClubId={club.id} clubName={club.name} />}
        {kind === 'fundraising' && <ClubFundraisingPage />}
    </div>;
}
