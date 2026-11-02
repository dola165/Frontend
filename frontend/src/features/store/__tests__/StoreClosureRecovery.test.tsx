import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { LeaveClubDialog } from '../../clubOperations/leaving/LeaveClubDialog';
import { StoreProductsPage } from '../../clubWorkspace/commerce/StoreProductsPage';
import { dissolveClub } from '../../clubs/api';
import { fetchAllClubStoreProducts } from '../api';

// Purchase requests switched on: the club's incoming requests are there to resolve.
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 2, navigationCapabilities: { version: 1, workspaces: [{ id: 'store.purchase-requests', context: { type: 'user', id: 2, label: 'My requests' } }] } }, status: 'authenticated', refreshNavigationCapabilities: vi.fn() }) }));
vi.mock('../../../hooks/useCan', () => ({ refreshAccess: vi.fn() }));
vi.mock('../../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (english: string) => english }));
vi.mock('../copy', () => ({ ct: (text: string) => text, useCommerceCopy: vi.fn() }));
vi.mock('../../clubs/api', () => ({ dissolveClub: vi.fn() }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchAllClubStoreProducts: vi.fn() }));
vi.mock('../orders/StoreOrders', () => ({ StoreOrders: ({ seller }: { seller: number }) => <p>Incoming Store requests for club {seller}</p> }));
beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('userId', '2'); localStorage.setItem('gk-session-id', 'closure-session'); });

it('closure refusal keeps the dialog and offers the existing club Store requests door', async () => {
    vi.mocked(dissolveClub).mockRejectedValue({ response: { status: 409, data: { code: 'STORE_ORDERS_UNRESOLVED', message: 'Resolve accepted Store purchase requests first. Current staff access is kept.' } } });
    const done = vi.fn();
    render(<MemoryRouter initialEntries={['/clubs/10/office?leave=10:close']}><LeaveClubDialog clubId={10} clubName="Actual club" onDone={done} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Close the club' }));
    const recovery = await screen.findByRole('link', { name: 'Resolve Store purchase requests' });
    expect(recovery).toHaveAttribute('href', '/clubs/10/office?tab=tools&tool=store&storeRequests=1');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(done).not.toHaveBeenCalled();
});

it('the closure recovery address opens incoming requests directly in the existing Store tool', async () => {
    vi.mocked(fetchAllClubStoreProducts).mockResolvedValue([]);
    render(<MemoryRouter initialEntries={['/clubs/10/office?tab=tools&tool=store&storeRequests=1']}><StoreProductsPage clubId={10} /></MemoryRouter>);
    expect(await screen.findByText('Incoming Store requests for club 10')).toBeInTheDocument();
    expect(screen.getByText('Purchase requests').closest('details')).toHaveAttribute('open');
});
