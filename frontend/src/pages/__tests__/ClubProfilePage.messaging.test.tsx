import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ClubProfilePage } from '../ClubProfilePage';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn().mockResolvedValue(null), fetchClubManagementOverview: vi.fn(), dissolveClub: vi.fn() }));
vi.mock('../../components/club/ClubHero', () => ({ ClubHero: ({ onOpenMessage }: { onOpenMessage: () => void }) => <button onClick={onOpenMessage}>Message club</button> }));
vi.mock('../../components/club/ClubProfileStickyHeader', () => ({ ClubProfileStickyHeader: () => null }));
vi.mock('../../components/club/ClubProfileInfoPanel', () => ({ ClubProfileInfoPanel: () => null }));
vi.mock('../../components/club/ClubOpportunities', () => ({ ClubOpportunities: () => null }));
vi.mock('../../components/club/tabs/TabOverview', () => ({ TabOverview: () => null }));
const Destination = () => { const location = useLocation(); return <p data-testid="destination">{location.pathname}{location.search}</p>; };
beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'authenticated', user: { id: 7 } } as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockImplementation(async (path) => ({ data: path.endsWith('/staff')
        ? [{ userId: 12, fullName: 'Sam Coach', role: 'COACH' }]
        : { id: 4, name: 'City FC', isStaffMember: false, whatsappNumber: '+995555123456', opportunities: [], honours: [], trustedByClubs: [] } }));
});
const open = async () => {
    render(<MemoryRouter initialEntries={['/clubs/4']}><Routes><Route path="/clubs/:id" element={<ClubProfilePage />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Message club' }));
};
it('does not auto-open the only external contact and navigates to the selected in-app recipient', async () => {
    const external = vi.spyOn(window, 'open').mockImplementation(() => null);
    await open(); expect(await screen.findByRole('dialog')).toBeInTheDocument(); expect(external).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /Message Sam Coach/ }));
    expect(await screen.findByTestId('destination')).toHaveTextContent('/messages?chatWith=12'); external.mockRestore();
});
it('keeps the selected recipient when an anonymous visitor needs to sign in', async () => {
    vi.mocked(useAuth).mockReturnValue({ sessionId: null, status: 'anonymous', user: null } as ReturnType<typeof useAuth>);
    await open(); fireEvent.click(await screen.findByRole('button', { name: /Sign in to message Sam Coach/ }));
    const destination = await screen.findByTestId('destination');
    expect(destination.textContent).toMatch(/^\/login\?/);
    expect(decodeURIComponent(destination.textContent ?? '')).toContain('/messages?chatWith=12');
});
