import { officePath, officeToolPath } from '../../clubOffice/officeLinks';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ClubStorePage } from '../../../pages/ClubStorePage';
import { ClubFundraisingPage } from '../../../pages/ClubFundraisingPage';
import { ClubJobsPage } from '../../../pages/ClubJobsPage';
import { involvedKindFrom, isWide, type InvolvedKind } from './clubTabs';
import type { ClubProfile } from './types';
import { projectsPath } from '../../projects/projectWords';
import { EditLink } from './ClubInfo';

const kinds: Record<InvolvedKind, { label: string; hint: string; all: string; global: string }> = {
    store: { label: 'Club store', hint: 'Kit and club essentials', all: 'All stores', global: '/store' },
    jobs: { label: 'Club jobs', hint: 'Work and volunteer here', all: 'All jobs', global: '/jobs' },
    fundraising: { label: 'Club fundraising', hint: 'Projects the club is raising money for', all: 'All fundraising', global: '/campaigns' },
};

/**
 * The club's store, jobs and fundraising in full, inside the club page. The Get involved block on the right is the switch
 * between the three; one line above the page names it, lets the viewer fold the club information away, and points at
 * the global counterpart. The pages read the club from the address, as on their own routes.
 */
export function ClubInvolvedTab({ club, canEdit = false }: { club: ClubProfile; canEdit?: boolean }) {
    const [params, setParams] = useSearchParams();
    const kind = involvedKindFrom(params);
    const current = kinds[kind];
    const wide = isWide(params);
    const toggleWide = () => setParams(query => { const next = new URLSearchParams(query); if (wide) next.delete('wide'); else next.set('wide', '1'); return next; }, { replace: true });
    return <div className="gk-club-involved" aria-label={`Get involved with ${club.name}`}>
        <div className="gk-club-involved__bar">
            <div className="gk-club-involved__title"><h2>{current.label}</h2><span className="gk-muted">{current.hint}</span></div>
            <div className="gk-row">
                {canEdit && <EditLink to={kind === 'jobs' ? officePath(club.id, 'staff', { view: 'jobs' }) : kind === 'fundraising' ? projectsPath(club.id) : officeToolPath(club.id, 'store')} />}
                <button type="button" className="gk-btn gk-btn--secondary gk-btn--sm" aria-pressed={wide} onClick={toggleWide}>{wide ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}{wide ? 'Show club info' : 'Hide club info'}</button>
                <Link className="gk-section__action gk-row" to={current.global}>{current.all}<ArrowUpRight size={14} aria-hidden="true" /></Link>
            </div>
        </div>
        {kind === 'store' && <ClubStorePage />}
        {kind === 'jobs' && <ClubJobsPage />}
        {kind === 'fundraising' && <ClubFundraisingPage />}
    </div>;
}
