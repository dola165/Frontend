import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { AccessAction, AccessDecision } from '../../api/access';
import type { AuthSessionId } from '../../utils/authStorage';
import { ClubOffice } from './ClubOffice';

// What Club office reads, each load answering as the test says.
type Can = { pending: boolean; failed: boolean; decide: (action: AccessAction) => AccessDecision };
const loads = vi.hoisted(() => ({
    overview: { overview: null, loading: false, error: 'Request failed with status code 403', forbidden: true, reload: vi.fn(async () => undefined) },
    roles: { data: null as unknown, loading: false, error: 'The jobs could not be loaded.' as string | null, refresh: vi.fn() },
    can: { pending: false, failed: true, decide: () => ({ allowed: false }) } as Can,
}));
const access = vi.hoisted(() => ({ refresh: vi.fn() }));
const saveBirthDate = vi.hoisted(() => vi.fn<(date: string) => Promise<void>>(async () => undefined));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9, dob: '1990-01-01' }, bootstrapSession: async () => undefined }) }));
vi.mock('../../hooks/useCan', () => ({ useCan: () => loads.can, refreshAccess: access.refresh }));
vi.mock('../profiles/api', () => ({ saveBirthDate }));
vi.mock('../clubWorkspace/useClubOverview', () => ({ useClubOverview: () => loads.overview }));
vi.mock('../clubOperations/useClubOperations', () => ({ useClubOperations: () => ({ boot: null, loading: false, refresh: vi.fn(async () => undefined) }) }));
vi.mock('../clubOperations/useWorkspaceRoles', () => ({ useWorkspaceRoles: () => loads.roles }));
vi.mock('../admissions/club/useClubAdmissions', () => ({ useClubAdmissions: () => ({ data: null, loading: false, error: '' }) }));
vi.mock('../clubOperations/people/ClubPeople', () => ({ ClubPeople: () => <h1>Staff</h1> }));

afterEach(cleanup);
const mount = () => render(<MemoryRouter initialEntries={['/clubs/7/office']}><Routes>
    <Route path="/clubs/:id/office" element={<ClubOffice clubId={7} sessionId={'fixture' as AuthSessionId} />} />
</Routes></MemoryRouter>);

it('says a failed load and offers Try again, even when the overview refuses a job holder', () => {
    // A physio's job has no staff membership, so the management overview always answers 403.
    mount();
    expect(screen.getByRole('alert')).toHaveTextContent('The jobs could not be loaded.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Club office is for the club’s staff')).not.toBeInTheDocument();
});

it('names the place in the phone bar, whatever section is open', () => {
    loads.roles = { data: { views: [{ id: 'job', label: 'Physio', modules: [], squadIds: [], clubWide: true }] } as unknown, loading: false, error: null, refresh: vi.fn() };
    loads.can = { pending: false, failed: false, decide: () => ({ allowed: true }) };
    mount();
    expect(document.querySelector('.gk-ws__bar-title strong')).toHaveTextContent('Club office');
    expect(screen.getByRole('heading', { name: 'Staff' })).toBeInTheDocument();
});

it('asks a staff member without a birth date for it once, then loads Staff', async () => {
    // The server answers Staff with BIRTH_DATE_NEEDED until the account has a birth date.
    const refused: Can = { pending: false, failed: false, decide: action => action === 'see_staff' ? { allowed: false, code: 'BIRTH_DATE_NEEDED' } : { allowed: false } };
    loads.can = refused;
    saveBirthDate.mockImplementation(async () => { loads.can = { pending: false, failed: false, decide: () => ({ allowed: true }) }; });
    mount();
    expect(screen.queryByText('Club office is for the club’s staff')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Your date of birth' })).toBeInTheDocument();
    // Closed, the step stays one click away.
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add your date of birth' }));
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-05-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Staff' })).toBeInTheDocument();
    expect(saveBirthDate).toHaveBeenCalledWith('1990-05-01');
    expect(access.refresh).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
