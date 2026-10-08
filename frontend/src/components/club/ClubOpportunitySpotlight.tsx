import { ArrowRight, ArrowUpRight, HeartHandshake, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatStorePrice } from '../../features/store/api';
import { labelForEngagement } from '../../features/clubs/jobLabels';
import { applicationMethodLabel, eligibilityLabel, labelForCategory } from '../../features/clubs/jobLabels';
import { CampaignProgress } from '../../features/campaigns/CampaignProgress';
import { campaignDate } from '../../features/campaigns/api';
import { clubOpportunityReturnState } from '../discovery/opportunityReturnContext';
import { MediaImage } from '../ui/MediaImage';
import './club-opportunity-spotlight.css';
import { useState, type ReactNode } from 'react';

import {useClubOpportunityPreview} from './useClubOpportunityPreview';
type Props = { clubId: number; items: ReturnType<typeof useClubOpportunityPreview> };
export function ClubOpportunitySource({clubId, children}: {clubId:number; children:(items:Props['items']) => ReactNode}) {
    return children(useClubOpportunityPreview(clubId));
}
const countLabel = (item: Props['items'][number]) => item.source.loading ? 'Loading…' : item.source.failed ? 'Currently unavailable'
    : `${item.count ?? 0} ${item.count === 1 ? item.unit.slice(0, -1) : item.unit}`;

export function ClubOpportunitySpotlight({ clubId, items }: Props) {
    const featured = items.filter(item => item.itemTo || item.source.loading || item.source.failed);
    if (!featured.length) return null;
    return <section className="co-opportunity-spotlight" aria-label="Support & opportunities">
        <header className="co-heading"><div><p className="co-eyebrow">Support & opportunities</p><h2>Be part of what’s next.</h2></div><Link className="co-link" to={`/clubs/${clubId}?tab=business`}>View all<ArrowRight size={16}/></Link></header>
        <div className="co-opportunity-cards">{featured.map(item => <article className={`co-opportunity-card co-opportunity-${item.key}`} key={item.key}>
            <header className="co-opportunity-panel-heading"><Link className="co-opportunity-title" to={item.to}><span className="co-opportunity-icon"><item.icon size={21}/></span><span><strong>{item.title}</strong><small>{item.note}</small></span><ArrowUpRight size={17}/></Link><span className="co-opportunity-count">{countLabel(item)}</span></header>
            <div className="co-opportunity-content">
                {item.source.loading ? <div className="co-opportunity-loading" role="status">Loading published content…</div>
                    : item.source.failed ? <div className="co-opportunity-empty"><p>Content couldn’t load.</p><button onClick={item.source.retry}>Try again</button></div>
                    : item.key === 'store' ? <div className="co-store-selection">{item.products.slice(0, 4).map(product => <Link className="co-store-product" key={product.id} to={`/store/products/${product.id}`} state={clubOpportunityReturnState('store', clubId)}>
                        <OpportunityImage src={product.images?.[0]} kind="store"/><div><span className="co-product-category">{product.category?.toLowerCase().replaceAll('_', ' ') || 'Club collection'}</span><h3>{product.name}</h3><strong className="co-product-price">{product.price == null ? 'Price not published' : formatStorePrice(product.price, product.currency)}</strong><span className="co-product-options">{product.variants?.length ? 'View sizes & availability' : 'View product details'}</span></div><ArrowUpRight size={16}/>
                    </Link>)}</div>
                    : item.key === 'campaigns' ? <div className="co-campaign-selection">{item.campaigns.slice(0, 2).map(campaign => <Link className="co-opportunity-detail" key={campaign.id} to={`/campaigns/${campaign.id}`} state={clubOpportunityReturnState('campaigns', clubId)}>
                        <div className="co-opportunity-detail-title">{campaign.images?.[0] && <OpportunityImage src={campaign.images[0]} kind="campaigns"/>}<h3>{campaign.title}</h3><ArrowUpRight size={17}/></div><p className="co-opportunity-description">{campaign.summary}</p><CampaignProgress campaign={campaign} compact/>{campaign.endsOn && <span className="co-opportunity-meta">Ends {campaignDate(campaign.endsOn)}</span>}
                    </Link>)}<p className="co-opportunity-note">Figures reported by the club, unverified by GrassKickZ.</p></div>
                    : <div className="co-role-selection">{item.jobs.slice(0, 2).map(job => <Link className="co-opportunity-detail" key={job.id} to={`/jobs/${job.id}`} state={clubOpportunityReturnState('jobs', clubId)}>
                        <span className="co-role-category">{labelForCategory(job.category)}</span><div className="co-opportunity-detail-title"><h3>{job.title}</h3><ArrowUpRight size={17}/></div>{job.description && <p className="co-opportunity-description">{job.description}</p>}<div className="co-role-facts"><span>{labelForEngagement(job.engagementType)}</span>{eligibilityLabel(job) && <span>{eligibilityLabel(job)}</span>}<span>{applicationMethodLabel(job)}</span></div><span className="co-opportunity-detail-action">Explore this role<ArrowRight size={15}/></span>
                    </Link>)}</div>}
            </div>
            <Link className="co-opportunity-footer" to={item.to}>{item.action}<ArrowRight size={17}/></Link>
        </article>)}</div>
    </section>;
}

export function ClubOpportunityRail({ clubId, items }: Props) {
    return <nav className="co-opportunity-nav" aria-label="Club opportunities"><p className="co-eyebrow">Get involved</p>{items.map(item => <Link className={`co-opportunity-quick co-opportunity-${item.key}`} key={item.key} to={item.to}><span className="co-opportunity-icon"><item.icon size={19}/></span><span><strong>{item.title}</strong><small>{countLabel(item)}</small></span><ArrowUpRight size={16}/></Link>)}<Link className="co-opportunity-all" to={`/clubs/${clubId}?tab=business`}>All opportunities<ArrowRight size={15}/></Link></nav>;
}

function OpportunityImage({src, kind}:{src?:string;kind:'store'|'campaigns'}) {
    const [failed, setFailed] = useState<string>();
    return <span className="co-opportunity-thumbnail">{src && failed !== src ? <MediaImage src={src} alt="" loading="lazy" onError={() => setFailed(src)}/> : kind === 'store' ? <ShoppingBag size={25}/> : <HeartHandshake size={25}/>}</span>;
}
