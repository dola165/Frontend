import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ClubBusinessTab } from '../../club/ClubBusinessTab';
import { ClubProfileStickyHeader } from '../../club/ClubProfileStickyHeader';
import { OpportunityNavigation } from '../OpportunityNavigation';
import { DiscoverySectionTabs } from '../DiscoverySectionTabs';
import type { ClubProfile } from '../../../pages/ClubProfilePage';
vi.mock('../../../pages/JobsDirectoryPage', () => ({ JobsDirectoryPage: ({ fixedClubId }: { fixedClubId: number }) => <div>Jobs for club {fixedClubId}</div> }));
vi.mock('../../../features/store/api', async original => ({...await original<typeof import('../../../features/store/api')>(),fetchStoreCatalog:vi.fn(async()=>({content:[],totalElements:0}))}));
vi.mock('../../../features/campaigns/api', async original => ({...await original<typeof import('../../../features/campaigns/api')>(),fetchCampaigns:vi.fn(async()=>({content:[],totalElements:0}))}));
vi.mock('../../../features/clubs/api',()=>({fetchClubJobs:vi.fn(async()=>[])}));
const club = { id: 10, name: 'Alpha FC' } as ClubProfile;
it('shows one Opportunities tab instead of three separate profile tabs', () => {
 const change=vi.fn();render(<ClubProfileStickyHeader activeTab="overview" onTabChange={change} club={{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Opportunities'}));expect(change).toHaveBeenCalledWith('business');
 for(const name of ['Store','Campaigns','Roles']) expect(screen.queryByRole('button',{name})).not.toBeInTheDocument();
});
it('offers three scoped choices and opens Roles inside the club area', () => {
 render(<MemoryRouter initialEntries={['/clubs/10?tab=business']}><ClubBusinessTab club={club} ownClubRole={null} isAuthenticated={false}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:/Open club store/})).toHaveAttribute('href','/clubs/10/store');
 expect(screen.getByRole('link',{name:/Open club campaigns/})).toHaveAttribute('href','/clubs/10/campaigns?state=ALL');
 fireEvent.click(screen.getByRole('link',{name:/View club roles/}));expect(screen.getByText('Jobs for club 10')).toBeInTheDocument();
});
it.each(['store','campaigns','jobs'] as const)('provides explicit %s return and general routes on direct entry', section => {
 render(<MemoryRouter><OpportunityNavigation section={section} clubId={10} detail/></MemoryRouter>);
 expect(screen.getByRole('link',{name:section === 'jobs' ? 'Back to roles' : `Back to ${section}`})).toHaveAttribute('href',section==='jobs'?'/clubs/10?tab=business&opportunity=jobs':`/clubs/10/${section}`);
 expect(screen.getByRole('link',{name:/Browse all/})).toHaveAttribute('href',`/${section}`);
});
it('returns to a filtered global list while Browse all stays unfiltered', () => {
 render(<MemoryRouter initialEntries={[{pathname:'/jobs/1',state:{opportunityReturn:{section:'jobs',pathname:'/jobs',search:'?country=Georgia&page=2'}}}]}><OpportunityNavigation section="jobs" detail/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Back to roles'})).toHaveAttribute('href','/jobs?country=Georgia&page=2');
 expect(screen.getByRole('link',{name:'Browse all roles'})).toHaveAttribute('href','/jobs');
});
it('returns to the originating club list with its filters', () => {
 render(<MemoryRouter initialEntries={[{pathname:'/store/products/1',state:{opportunityReturn:{section:'store',pathname:'/clubs/10/store',search:'?query=shirt&page=1'}}}]}><OpportunityNavigation section="store" clubId={10} detail/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Back to store'})).toHaveAttribute('href','/clubs/10/store?query=shirt&page=1');
});
it('rejects an external return path and uses the deterministic club fallback', () => {
 render(<MemoryRouter initialEntries={[{pathname:'/campaigns/1',state:{opportunityReturn:{section:'campaigns',pathname:'https://example.com/phish',search:''}}}]}><OpportunityNavigation section="campaigns" clubId={10} detail/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Back to campaigns'})).toHaveAttribute('href','/clubs/10/campaigns');
});
it('preserves club scope when switching discovery sections',()=>{
 render(<MemoryRouter initialEntries={['/clubs/10/store']}><DiscoverySectionTabs/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Fundraising & campaigns'})).toHaveAttribute('href','/clubs/10/campaigns');
 expect(screen.getByRole('link',{name:'Stadiums'})).toHaveAttribute('href','/stadiums');
 expect(screen.getByRole('link',{name:/Roles/})).toHaveAttribute('href','/clubs/10?tab=business&opportunity=jobs');
});
