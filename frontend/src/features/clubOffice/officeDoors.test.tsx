import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ClubWorkspaceRedirect from '../../pages/ClubWorkspaceRedirect';
import type { AuthSessionId } from '../../utils/authStorage';
import { OfficeTool } from './OfficeTool';
import type { OfficeTool as Tool } from './officeLinks';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
// The older screens themselves are tested on their own; here only their doors matter.
vi.mock('../clubWorkspace/players/PlayersPage', () => ({ PlayersPage: ({ onTabChange }: { onTabChange: (tab: string) => void }) => <>
    <button type="button" onClick={() => onTabChange('player-cards')}>Player cards</button>
    <button type="button" onClick={() => onTabChange('squads')}>Manage squads</button>
</> }));
vi.mock('../clubWorkspace/players/PlayerCardsPage', () => ({ PlayerCardsPage: () => <h2>The club's player cards</h2> }));
vi.mock('../clubWorkspace/ClubDecisionDialogs', () => ({ ClubDecisionDialogs: () => null }));
vi.mock('../clubWorkspace/useClubMembership', () => ({ useClubMembership: () => ({
    errorMessage: null, successMessage: null, setErrorMessage: vi.fn(), setSuccessMessage: vi.fn(), pendingKey: null, actions: {}, applications: {},
    players: { directory: null, loading: false, error: null, filter: 'ALL', setFilter: vi.fn(), setPage: vi.fn(), reload: vi.fn(), show: vi.fn(), invalidate: vi.fn() },
}) }));

afterEach(cleanup);

function Where() { const where = useLocation(); return <output data-testid="where">{where.pathname + where.search}</output>; }
const where = () => screen.getByTestId('where').textContent;

/** Club office's More tools as ClubOffice mounts it: the tool named in the address. */
function Tools() {
    const [params] = useSearchParams();
    if (params.get('tab') !== 'tools') return null;
    return <OfficeTool clubId={7} tool={params.get('tool') as Tool} state="open" sessionId={'fixture' as AuthSessionId} overview={{ currentUserRole: 'OWNER' } as never}
        reloadOverview={async () => {}} boot={null} bootLoading={false} bootError={null} refreshBoot={async () => {}} roles={null} refreshRoles={() => {}}
        admissions={{ data: null, loading: false, error: '' } as never} leader admin={null} />;
}
const mount = (entry: string) => render(<MemoryRouter initialEntries={[entry]}><Where /><Routes>
    <Route path="/clubs/:id/workspace" element={<ClubWorkspaceRedirect />} />
    <Route path="/clubs/:id/office" element={<Tools />} />
    <Route path="*" element={null} />
</Routes></MemoryRouter>);

it.each([
    ['/clubs/7/workspace', '/clubs/7/office'],
    ['/clubs/7/workspace?squad=5', '/clubs/7/office?squad=5'],
    ['/clubs/7/workspace?tab=overview', '/requests'],
    ['/clubs/7/workspace?tab=inbox', '/requests?view=updates'],
    ['/clubs/7/workspace?tab=player-cards', '/clubs/7/office?tab=tools&tool=player-cards'],
])('an old address %s opens %s', (from, to) => {
    mount(from);
    expect(where()).toBe(to);
});

it('opens Player cards from Players, and Manage squads opens Squads', () => {
    mount('/clubs/7/office?tab=tools&tool=players');
    fireEvent.click(screen.getByRole('button', { name: 'Player cards' }));
    expect(where()).toBe('/clubs/7/office?tab=tools&tool=player-cards');
    expect(screen.getByRole('heading', { name: "The club's player cards" })).toBeInTheDocument();
    cleanup();
    mount('/clubs/7/office?tab=tools&tool=players');
    fireEvent.click(screen.getByRole('button', { name: 'Manage squads' }));
    expect(where()).toBe('/clubs/7/office?tab=squads');
});

it('leads back to the squad a tool was opened from, else to More tools', () => {
    mount('/clubs/7/office?tab=tools&tool=player-cards&return=squads&squad=5');
    fireEvent.click(screen.getByRole('button', { name: 'Squads' }));
    expect(where()).toBe('/clubs/7/office?tab=squads&squad=5');
    cleanup();
    mount('/clubs/7/office?tab=tools&tool=player-cards');
    fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
    expect(where()).toBe('/clubs/7/office?tab=tools');
});
