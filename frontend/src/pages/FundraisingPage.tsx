import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { HeartHandshake, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ButtonLink, GkRoot, PageFrame, SearchInput } from '../design/primitives';
import { CAMPAIGN_CATEGORIES, campaignMoney, fetchFundraisingFront } from '../features/campaigns/api';
import { FundraiserRow } from '../features/campaigns/FundraiserCard';
import { FUNDRAISING_KEYS, fundraisingPath } from '../features/campaigns/query';
import { CircleStrip, MarketTabs } from '../features/store/front/MarketTabs';
import { AreaPicker } from '../features/store/front/StoreFrontRows';
import { useWorldArea } from '../features/world/useWorldArea';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';

/**
 * Fundraising, in GoFundMe's shape and the store's skin: one search and one big "Start a fundraiser", then
 * categories, the fundraisers near the person, the ones nearly there, the clubs they follow and the newest.
 * Donations are taken on GoFundMe; GrassKickZ shows the projects and sends supporters there.
 */
export const FundraisingPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { status } = useAuth();
    const { area, setCity } = useWorldArea();
    const [text, setText] = useState('');
    const near = area.anywhere ? undefined : area.city;
    const front = useWorldData(area.ready ? `fund-front:${near ?? ''}` : null, signal => fetchFundraisingFront(near, signal), 'Fundraisers could not load.');
    if (FUNDRAISING_KEYS.some(key => key !== 'page' && params.has(key)) || params.has('q')) return <Navigate to={`/campaigns/all?${params}`} replace />;
    const signedIn = status === 'authenticated';
    const followed = front.data?.followed ?? [];
    return (
        <GkRoot className="gk-store gk-page">
            <PageFrame>
                <MarketTabs current="fundraising" />
                <div className="gk-store-head">
                    <div><h1>Fundraising</h1><p className="gk-store-head__hint">Projects from clubs on GrassKickZ, backed by their supporters</p></div>
                    <form className="gk-store-head__search" role="search" onSubmit={event => { event.preventDefault(); navigate(fundraisingPath({ query: text.trim() })); }}>
                        <SearchInput aria-label="Search fundraisers" placeholder="Search fundraisers or clubs" maxLength={100} value={text} onChange={event => setText(event.target.value)} />
                    </form>
                    <div className="gk-store-head__actions">
                        <ButtonLink to={fundraisingPath()}>Browse all</ButtonLink>
                        <ButtonLink variant="primary" to="/campaigns/new"><Plus aria-hidden="true" />Start a fundraiser</ButtonLink>
                    </div>
                </div>
                <div className="gk-store-stack">
                    <article className="gk-store-door gk-fund-hero">
                        <img className="gk-store-door__pic" src="/landing/after-the-whistle.png" alt="" />
                        <span className="gk-store-door__eyebrow"><HeartHandshake aria-hidden="true" size={16} />Fundraising on GrassKickZ</span>
                        <Link className="gk-store-door__title" to="/campaigns/new">Your club’s next project starts here</Link>
                        <p className="gk-store-door__line">Set a goal, tell the story, publish. Donations are taken on GoFundMe, so there is nothing to set up for payments.</p>
                        {front.data && <div className="gk-fund-hero__facts"><span><strong className="gk-num">{front.data.active}</strong>open fundraisers</span><span><strong className="gk-num">{campaignMoney(front.data.raised, 'GEL')}</strong>raised so far</span></div>}
                        <div className="gk-store-door__chips"><Link className="gk-store-door__chip" to="/campaigns/new">Start a fundraiser</Link><Link className="gk-store-door__chip" to={fundraisingPath({ sort: 'CLOSEST' })}>Nearly there</Link></div>
                    </article>
                    <CircleStrip title="Browse by cause" hint="What the money is for" label="Fundraisers by cause">
                        {CAMPAIGN_CATEGORIES.map(category => <Link key={category.value} className="gk-store-cat" to={fundraisingPath({ category: category.value })}><span className="gk-store-cat__icon"><category.icon aria-hidden="true" /></span><span>{category.label}</span></Link>)}
                    </CircleStrip>
                    <FundraiserRow title="Near you" hint={near ? <AreaPicker city={front.data?.city ?? near} onChange={setCity} /> : 'Open fundraisers'} campaigns={front.data?.near ?? []} loading={front.loading} error={front.error} retry={front.retry} empty={near ? `No open fundraiser near ${near} yet` : 'No open fundraiser yet'} action={{ label: 'View all', to: fundraisingPath() }} />
                    <FundraiserRow title="Nearly there" hint="Closest to their goal" to={fundraisingPath({ sort: 'CLOSEST' })} campaigns={front.data?.closest ?? []} loading={front.loading} error={front.error} retry={front.retry} empty="Nothing close to its goal yet" />
                    {signedIn && (front.loading || followed.length > 0) && <FundraiserRow title="From clubs you follow" hint="Clubs you follow with an open fundraiser" campaigns={followed} loading={front.loading} error={front.error} retry={front.retry} empty="None of the clubs you follow is raising money" />}
                    <FundraiserRow title="Just launched" hint="The newest fundraisers" to={fundraisingPath({ sort: 'NEWEST' })} campaigns={front.data?.fresh ?? []} loading={front.loading} error={front.error} retry={front.retry} empty="Nothing new yet" />
                </div>
            </PageFrame>
        </GkRoot>
    );
};
