import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, HeartHandshake, ShoppingBag } from 'lucide-react';
import { fetchStoreCatalog, formatStorePrice, type StoreProduct } from '../../features/store/api';
import { fetchCampaigns, campaignDate, type Campaign } from '../../features/campaigns/api';
import { CampaignProgress } from '../../features/campaigns/CampaignProgress';
import { fetchClubJobs, type ClubJob } from '../../features/clubs/api';
import { canManageClubOperations, isLeadershipRole, type ClubMembershipRole } from '../../features/clubs/domain';
import { labelForCategory, labelForEngagement } from '../../features/clubs/jobLabels';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import '../../features/campaigns/campaigns.css';

type Preview<T> = { items: T[]; total: number; loading: boolean; failed: boolean };
const empty = <T,>(): Preview<T> => ({ items: [], total: 0, loading: true, failed: false });
export const ClubOpportunityOverview = ({ clubId, role }: { clubId: number; role: ClubMembershipRole | null }) => {
    const [products, setProducts] = useState<Preview<StoreProduct>>(empty);
    const [campaigns, setCampaigns] = useState<Preview<Campaign>>(empty);
    const [jobs, setJobs] = useState<Preview<ClubJob>>(empty);
    const [reload, setReload] = useState(0);
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        // Each public source can fail or finish independently; never present a failed count as zero.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProducts(empty()); setCampaigns(empty()); setJobs(empty());
        void fetchStoreCatalog({ clubId, page: 0, size: 3, sort: 'NEWEST' }, controller.signal)
            .then(data => { if (active) setProducts({ items: data.content, total: data.totalElements, loading: false, failed: false }); })
            .catch(() => { if (active) setProducts({ ...empty(), loading: false, failed: true }); });
        void fetchCampaigns({ clubId, page: 0, size: 3, state: 'ACTIVE', sort: 'NEWEST' }, controller.signal)
            .then(data => { if (active) setCampaigns({ items: data.content, total: data.totalElements, loading: false, failed: false }); })
            .catch(() => { if (active) setCampaigns({ ...empty(), loading: false, failed: true }); });
        void fetchClubJobs(clubId, controller.signal)
            .then(data => { if (active) setJobs({ items: data.slice(0, 3), total: data.length, loading: false, failed: false }); })
            .catch(() => { if (active) setJobs({ ...empty(), loading: false, failed: true }); });
        return () => { active = false; controller.abort(); };
    }, [clubId, reload]);
    const count = <T,>(data: Preview<T>, label: string) => data.loading ? 'Loading...' : data.failed ? 'Unavailable' : `${data.total} ${data.total === 1 ? label.slice(0, -1) : label}`;
    const state = <T,>(data: Preview<T>, label: string) => data.loading ? <p role="status">Loading {label}...</p> : data.failed ? <div role="alert">Could not load {label}. <button className="opportunity-nav-button" onClick={() => setReload(n => n + 1)}>Retry {label}</button></div> : null;
    return <>
        <div className="opportunity-overview-tools"><p>Latest published content from this club. Open a section to see everything.</p><button className="opportunity-nav-button" onClick={() => setReload(n => n + 1)}>Refresh overview</button></div>
        <div className="opportunity-overview-grid">
            <section className="store-page opportunity-overview-card" aria-label="Club store preview">
                <header><ShoppingBag size={24}/><h3>Store</h3><span>{count(products, 'published products')}</span></header>
                {state(products, 'products')}
                {!products.loading && !products.failed && (products.total ? <div className="opportunity-preview-list">{products.items.map(product => <Link key={product.id} className="opportunity-product-preview" to={`/store/products/${product.id}`}>
                    {product.images?.[0] ? <img src={resolveMediaUrl(product.images[0])} alt=""/> : <span className="opportunity-photo-placeholder"><ShoppingBag size={24}/></span>}
                    <div><h4>{product.name}</h4><strong>{formatStorePrice(product.price ?? 0, product.currency)}</strong><p>{product.variants?.some(v => v.stock > 0) ? 'Available in selected sizes / variants' : 'Out of stock'}</p></div>
                </Link>)}</div> : <p className="opportunity-preview-empty">This club has not published any products yet.</p>)}
                <footer><p>Online checkout is not available yet. You can browse products and prepare a cart.</p><Link className="opportunity-nav-button" to={`/clubs/${clubId}/store`}>Open club store<ArrowRight size={16}/></Link>{isLeadershipRole(role) && <Link to={`/clubs/${clubId}/workspace?tab=store`} className="opportunity-manage-link">Manage products</Link>}</footer>
            </section>
            <section className="store-page campaigns-page opportunity-overview-card" aria-label="Club campaign preview">
                <header><HeartHandshake size={24}/><h3>Fundraising & campaigns</h3><span>{count(campaigns, 'active campaigns')}</span></header>
                {state(campaigns, 'campaigns')}
                {!campaigns.loading && !campaigns.failed && (campaigns.total ? <div className="opportunity-preview-list">{campaigns.items.map(campaign => <article key={campaign.id} className="opportunity-campaign-preview">
                    <Link to={`/campaigns/${campaign.id}`}><h4>{campaign.title}</h4></Link><p>{campaign.summary}</p><CampaignProgress campaign={campaign} compact/>{campaign.endsOn && <p>Ends {campaignDate(campaign.endsOn)}</p>}
                </article>)}</div> : <p className="opportunity-preview-empty">No campaigns are active right now. Open the section to explore past and upcoming projects.</p>)}
                <footer><p>Reported funds are the club's own figures, unverified by GrassKickZ. Online contributions are not available yet.</p><Link className="opportunity-nav-button" to={`/clubs/${clubId}/campaigns?state=ALL`}>Open club campaigns<ArrowRight size={16}/></Link>{isLeadershipRole(role) && <Link to={`/clubs/${clubId}/workspace?tab=campaigns`} className="opportunity-manage-link">Manage campaigns</Link>}</footer>
            </section>
            <section className="store-page jobs-page opportunity-overview-card" aria-label="Club jobs preview">
                <header><BriefcaseBusiness size={24}/><h3>Jobs & volunteering</h3><span>{count(jobs, 'open roles')}</span></header>
                {state(jobs, 'roles')}
                {!jobs.loading && !jobs.failed && (jobs.total ? <div className="opportunity-preview-list">{jobs.items.map(job => <Link key={job.id} to={`/jobs/${job.id}`} className="opportunity-job-preview"><h4>{job.title}</h4><p>{labelForCategory(job.category)} · {labelForEngagement(job.engagementType)}</p>{job.ageGroup && <p>Team: {job.ageGroup}</p>}<p>{job.requiredRole === 'PLAYER' || job.requiredRole === 'COACH' ? 'Apply through GrassKickZ' : 'Contact the club to apply'}</p></Link>)}</div> : <p className="opportunity-preview-empty">No open roles have been published. Check back for new opportunities.</p>)}
                <footer><p>Explore paid roles and volunteering. Each opening explains how to apply.</p><Link className="opportunity-nav-button" to={`/clubs/${clubId}?tab=business&opportunity=jobs`}>View club jobs & volunteering<ArrowRight size={16}/></Link>{canManageClubOperations(role) && <Link to={`/clubs/${clubId}/workspace?tab=jobs`} className="opportunity-manage-link">Manage jobs and applications</Link>}</footer>
            </section>
        </div>
    </>;
};
