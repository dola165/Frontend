import { usePagesCopy } from '../../pages/copy';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { ButtonLink, List, ListRow } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import { Crest } from '../../world/Crest';
import { safePublicUrl } from '../presentation';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useClubOpportunityPreview } from './useClubOpportunityPreview';
import { clubTabFrom, involvedKindFrom } from './clubTabs';
import { EditLink } from './ClubInfo';
import type { ClubProfile } from './types';

/** The right column beside every club tab: the club's store, jobs and fundraising (the open one marked), then its sponsors. */
export function ClubSide({ club, canEdit = false }: { club: ClubProfile; canEdit?: boolean }) {
    const t = usePagesCopy();
    // Visitors see only what the club has published: an empty store, jobs list or fundraising stays out of sight.
    const opportunities = useClubOpportunityPreview(club.id).filter(item => canEdit || item.source.loading || Boolean(item.count));
    const [params] = useSearchParams();
    const open = clubTabFrom(params.get('tab')) === 'involved' ? involvedKindFrom(params) : null;
    const sponsors = club.presentation?.sponsors.filter(s => s.published && !s.promotionBlocked) ?? [];
    const affiliations = club.presentation?.affiliations.filter(a => a.status === 'ACTIVE') ?? [];
    return <>
        {opportunities.length > 0 && <SideBlock title={t("Get involved")} hint={t("Shop, work or give")} action={canEdit ? <EditLink to={`/clubs/${club.id}?edit=1&panel=involved`} /> : undefined}>
            <List label={t("Ways to get involved")}>{opportunities.map(item => <ListRow key={item.key} to={item.to} current={open === (item.key === 'campaigns' ? 'fundraising' : item.key)}
                lead={<span className="gk-club-icon" data-kind={item.key}><item.icon aria-hidden="true" /></span>} title={t(item.title)}
                meta={item.source.loading ? t('Loading…') : item.source.failed ? t('Currently unavailable') : item.count ? `${item.count} ${item.count === 1 ? t(item.unit.replace(/s$/, '')) : t(item.unit)}` : t(item.empty)} />)}</List>
        </SideBlock>}
        {/* The academy link itself sits under the club name; only managing it stays here. */}
        {affiliations.some(a => a.canManageProfile) && <SideBlock title={t("Academy profile")}>
            {affiliations.filter(a => a.canManageProfile).map(a => <ButtonLink key={a.id} size="sm" to={`/clubs/${a.clubId}/profile-settings`}>{t('Manage {name} profile', { name: a.name })}</ButtonLink>)}
        </SideBlock>}
        {sponsors.length > 0 && <SideBlock title={t("Sponsors")} hint={t("Backing the club")} action={canEdit ? <EditLink to={`/clubs/${club.id}?edit=1&panel=sponsors`} /> : undefined}>
            <List label={t("Sponsors")}>{sponsors.map(s => {
                const website = safePublicUrl(s.websiteUrl);
                const logo = s.logoUrl?.startsWith('/uploads/') ? resolveMediaUrl(s.logoUrl) : safePublicUrl(s.logoUrl);
                return <li key={s.id ?? s.name}>{website
                    ? <a className="gk-list-row" href={website} target="_blank" rel="noopener noreferrer"><Crest src={logo} name={s.name} size={36} /><span className="gk-list-row__main"><span className="gk-list-row__title">{s.name}</span></span><ArrowUpRight aria-hidden="true" className="gk-faint" size={16} /></a>
                    : <div className="gk-list-row"><Crest src={logo} name={s.name} size={36} /><span className="gk-list-row__main"><span className="gk-list-row__title">{s.name}</span></span></div>}</li>;
            })}</List>
        </SideBlock>}
    </>;
}
