import { ArrowUpRight } from 'lucide-react';
import { ButtonLink, List, ListRow } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import { Crest } from '../../world/Crest';
import { safePublicUrl } from '../presentation';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useClubOpportunityPreview } from './useClubOpportunityPreview';
import type { ClubProfile } from './types';

/** The right column beside every club tab: the club's store, jobs and fundraising, then its sponsors. */
export function ClubSide({ club }: { club: ClubProfile }) {
    const opportunities = useClubOpportunityPreview(club.id);
    const sponsors = club.presentation?.sponsors.filter(s => s.published && !s.promotionBlocked) ?? [];
    const affiliations = club.presentation?.affiliations.filter(a => a.status === 'ACTIVE') ?? [];
    return <>
        <SideBlock title="Get involved" hint="Shop, work or give">
            <List label="Ways to get involved">{opportunities.map(item => <ListRow key={item.key} to={item.to}
                lead={<span className="gk-club-icon" data-kind={item.key}><item.icon aria-hidden="true" /></span>} title={item.title}
                meta={item.source.loading ? 'Loading…' : item.source.failed ? 'Currently unavailable' : item.count ? `${item.count} ${item.count === 1 ? item.unit.replace(/s$/, '') : item.unit}` : item.empty} />)}</List>
        </SideBlock>
        {/* The academy link itself sits under the club name; only managing it stays here. */}
        {affiliations.some(a => a.canManageProfile) && <SideBlock title="Academy profile">
            {affiliations.filter(a => a.canManageProfile).map(a => <ButtonLink key={a.id} size="sm" to={`/clubs/${a.clubId}/profile-settings`}>Manage {a.name} profile</ButtonLink>)}
        </SideBlock>}
        {sponsors.length > 0 && <SideBlock title="Sponsors" hint="Backing the club">
            <List label="Sponsors">{sponsors.map(s => {
                const website = safePublicUrl(s.websiteUrl);
                const logo = s.logoUrl?.startsWith('/uploads/') ? resolveMediaUrl(s.logoUrl) : safePublicUrl(s.logoUrl);
                return <li key={s.id ?? s.name}>{website
                    ? <a className="gk-list-row" href={website} target="_blank" rel="noopener noreferrer"><Crest src={logo} name={s.name} size={36} /><span className="gk-list-row__main"><span className="gk-list-row__title">{s.name}</span></span><ArrowUpRight aria-hidden="true" className="gk-faint" size={16} /></a>
                    : <div className="gk-list-row"><Crest src={logo} name={s.name} size={36} /><span className="gk-list-row__main"><span className="gk-list-row__title">{s.name}</span></span></div>}</li>;
            })}</List>
        </SideBlock>}
    </>;
}
