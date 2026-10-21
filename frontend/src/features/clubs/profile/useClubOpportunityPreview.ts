import {BriefcaseBusiness,HeartHandshake,ShoppingBag} from 'lucide-react';
import {useOverviewSource} from '../useOverviewSource';
import {formatStorePrice,type StoreProduct} from '../../store/api';
import type {Campaign} from '../../campaigns/api';
import type {ClubJob} from '../api';
import {labelForEngagement} from '../jobLabels';
import {involvedPath} from './clubTabs';
type Page<T> = { content: T[]; totalElements: number };
/** The club's store, jobs and fundraising in one line each, for the side column; each opens inside the club page. */
export function useClubOpportunityPreview(clubId: number) {
    const products = useOverviewSource<Page<StoreProduct>>(`/store/products?clubId=${clubId}&page=0&size=4&sort=NEWEST`);
    const campaigns = useOverviewSource<Page<Campaign>>(`/campaigns?clubId=${clubId}&page=0&size=2&state=ACTIVE&sort=NEWEST`);
    const jobs = useOverviewSource<ClubJob[]>(`/clubs/${clubId}/jobs`);
    const product = products.data?.content?.[0], campaign = campaigns.data?.content?.[0], job = jobs.data?.[0];
    return [
        { key: 'store' as const, title: 'Club store', icon: ShoppingBag, to: involvedPath(clubId, 'store'), source: products, products: products.data?.content ?? [],
            count: products.data?.totalElements, unit: 'products', empty: 'No products published yet',
            name: product?.name, detail: product && (product.price == null ? 'Price not published' : formatStorePrice(product.price, product.currency)),
            image: product?.images?.[0], itemTo: product && `/store/products/${product.id}`, action: 'Explore the store', note: 'Kit, equipment & club essentials' },
        { key: 'jobs' as const, title: 'Club jobs', icon: BriefcaseBusiness, to: involvedPath(clubId, 'jobs'), source: jobs, jobs: jobs.data ?? [],
            count: jobs.data?.length, unit: 'openings', empty: 'No jobs or volunteering published',
            name: job?.title, detail: job && labelForEngagement(job.engagementType), image: undefined, itemTo: job && `/jobs/${job.id}`,
            action: 'Explore roles', note: 'Paid & ongoing volunteer positions' },
        { key: 'campaigns' as const, title: 'Club fundraising', icon: HeartHandshake, to: involvedPath(clubId, 'fundraising'), source: campaigns, campaigns: campaigns.data?.content ?? [],
            count: campaigns.data?.totalElements, unit: 'active campaigns', empty: 'No active campaigns',
            name: campaign?.title, detail: campaign?.summary, image: campaign?.images?.[0], itemTo: campaign && `/campaigns/${campaign.id}`,
            action: 'Explore campaigns', note: 'Fundraising & community projects' },
    ];
}
