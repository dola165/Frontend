import type { ComponentProps, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeartHandshake } from 'lucide-react';
import { MediaImage } from '../../components/ui/MediaImage';
import { opportunityReturnState } from '../../components/discovery/opportunityReturnContext';
import { Button, EmptyNote, Section } from '../../design/primitives';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { Row } from '../store/front/Row';
import { Crest } from '../world/Crest';
import { campaignMoney, daysLeft, progressOf, type Campaign } from './api';

/** The bar every fundraiser shows: raised of goal, the share, how many gave, how long is left. */
export function Progress({ campaign, large }: { campaign: Campaign; large?: boolean }) {
    const { raised, goal, percent, donations, reached } = progressOf(campaign);
    const left = daysLeft(campaign);
    return (
        <div className="gk-fund-progress" data-large={large || undefined} data-reached={reached || undefined}>
            {percent !== null && <div className="gk-fund-progress__bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${percent}% of the goal`}><span style={{ width: `${percent}%` }} /></div>}
            <p className="gk-fund-progress__amounts"><strong className="gk-num">{campaignMoney(raised, campaign.currency)}</strong>{goal !== null && <span className="gk-fund-progress__goal"> raised of {campaignMoney(goal, campaign.currency)}</span>}</p>
            <p className="gk-fund-progress__facts">{[donations != null ? `${donations} ${donations === 1 ? 'donation' : 'donations'}` : null, reached ? 'Goal reached' : left === null ? null : left === 0 ? 'Ended' : `${left} ${left === 1 ? 'day' : 'days'} left`].filter(Boolean).join(' · ')}</p>
        </div>
    );
}

const distance = (km: number) => km < 1 ? 'under 1 km' : `${Math.round(km)} km`;

/** One fundraiser the way GoFundMe lists them: the cover, the title, who runs it, the bar and the amounts. */
export function FundraiserCard({ campaign }: { campaign: Campaign }) {
    const location = useLocation();
    const picture = campaign.images?.[0];
    return (
        <Link className="gk-fund" to={`/campaigns/${campaign.id}`} state={opportunityReturnState('campaigns', location)}>
            <span className="gk-fund__pic">{picture ? <MediaImage src={resolveMediaUrl(picture)} alt="" loading="lazy" /> : <HeartHandshake aria-hidden="true" />}</span>
            <span className="gk-fund__title">{campaign.title}</span>
            <span className="gk-fund__club"><Crest src={campaign.clubLogoUrl} name={campaign.clubName} size={16} round /><span>{[campaign.clubName, campaign.city, campaign.distanceKm != null ? distance(campaign.distanceKm) : null].filter(Boolean).join(' · ')}</span></span>
            <Progress campaign={campaign} />
        </Link>
    );
}

export const FundraiserSkeletons = ({ count = 4 }: { count?: number }) => <>{Array.from({ length: count }, (_, i) => <li key={i}><span className="gk-skeleton gk-fund-skeleton" style={{ display: 'block' }} aria-hidden="true" /></li>)}</>;

/** A front-page row of fundraisers with "View all" opening the same search. */
export function FundraiserRow({ title, hint, to, campaigns, loading, error, retry, empty, action }: {
    title: string; hint?: ReactNode; to?: string; campaigns: Campaign[]; loading: boolean; error: string; retry: () => void; empty: string; action?: ComponentProps<typeof Section>['action'];
}) {
    return (
        <Section title={title} hint={hint} action={action ?? (to && campaigns.length ? { label: 'View all', to } : undefined)}>
            {error ? <EmptyNote title="These fundraisers could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote>
                : loading && !campaigns.length ? <ul className="gk-store-row gk-store-row--wide" aria-busy="true" aria-label="Loading fundraisers"><FundraiserSkeletons /></ul>
                : !campaigns.length ? <EmptyNote title={empty} />
                : <Row label={title} wide>{campaigns.map(campaign => <li key={campaign.id}><FundraiserCard campaign={campaign} /></li>)}</Row>}
        </Section>
    );
}
