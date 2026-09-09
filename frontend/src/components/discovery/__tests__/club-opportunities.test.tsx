import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ClubBusinessTab } from '../../club/ClubBusinessTab';
import { ClubProfileStickyHeader } from '../../club/ClubProfileStickyHeader';
import { OpportunityNavigation } from '../OpportunityNavigation';
import { DiscoverySectionTabs } from '../DiscoverySectionTabs';
import type { ClubProfile } from '../../../pages/ClubProfilePage';
vi.mock('../../../pages/JobsDirectoryPage', () => ({ JobsDirectoryPage: ({ fixedClubId }: { fixedClubId: number }) => <div>Jobs for club {fixedClubId}</div> }));
const club = { id: 10, name: 'Alpha FC' } as ClubProfile;
it('shows one Opportunities tab instead of three separate profile tabs', () => {
 const change=vi.fn();render(<ClubProfileStickyHeader activeTab="overview" onTabChange={change} club={{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Opportunities'}));expect(change).toHaveBeenCalledWith('business');
 for(const name of ['Store','Campaigns','Jobs & volunteering']) expect(screen.queryByRole('button',{name})).not.toBeInTheDocument();
});
it('offers three scoped choices and opens Jobs inside the club area', () => {
 render(<MemoryRouter initialEntries={['/clubs/10?tab=business']}><ClubBusinessTab club={club} ownClubRole={null} isAuthenticated={false}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:/Open club store/})).toHaveAttribute('href','/clubs/10/store');
 expect(screen.getByRole('link',{name:/Open club campaigns/})).toHaveAttribute('href','/clubs/10/campaigns');
 fireEvent.click(screen.getByRole('link',{name:/View club jobs/}));expect(screen.getByText('Jobs for club 10')).toBeInTheDocument();
});
it.each(['store','campaigns','jobs'] as const)('provides explicit %s return and general routes on direct entry', section => {
 render(<MemoryRouter><OpportunityNavigation section={section} clubId={10} detail/></MemoryRouter>);
 expect(screen.getByRole('link',{name:/Back to club/})).toHaveAttribute('href',section==='jobs'?'/clubs/10?tab=business&opportunity=jobs':`/clubs/10/${section}`);
 expect(screen.getByRole('link',{name:/Browse all/})).toHaveAttribute('href',`/${section}`);
});
it('preserves club scope when switching discovery sections',()=>{
 render(<MemoryRouter initialEntries={['/clubs/10/store']}><DiscoverySectionTabs/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Fundraising & campaigns'})).toHaveAttribute('href','/clubs/10/campaigns');
 expect(screen.getByRole('link',{name:/Jobs & volunteering/})).toHaveAttribute('href','/clubs/10?tab=business&opportunity=jobs');
});
