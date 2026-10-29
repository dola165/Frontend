import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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
    operations: { boot: null as unknown, loading: false, refresh: vi.fn(async () => undefined) },
}));
const access = vi.hoisted(() => ({ refresh: vi.fn() }));
const saveBirthDate = vi.hoisted(() => vi.fn<(date: string) => Promise<void>>(async () => undefined));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9, dob: '1990-01-01' }, bootstrapSession: async () => undefined }) }));
vi.mock('../../hooks/useCan', () => ({ useCan: () => loads.can, refreshAccess: access.refresh }));
vi.mock('../profiles/api', () => ({ saveBirthDate }));
vi.mock('../clubWorkspace/useClubOverview', () => ({ useClubOverview: () => loads.overview }));
vi.mock('../clubOperations/useClubOperations', () => ({ useClubOperations: () => loads.operations }));
vi.mock('../clubOperations/useWorkspaceRoles', () => ({ useWorkspaceRoles: () => loads.roles }));
vi.mock('../admissions/club/useClubAdmissions', () => ({ useClubAdmissions: () => ({ data: null, loading: false, error: '' }) }));
vi.mock('../clubOperations/people/ClubPeople', () => ({ ClubPeople: () => <h1>Staff</h1> }));
vi.mock('./OfficeTool', () => ({ OfficeTool: ({ tool }: { tool: string }) => <h1>Tool {tool}</h1> }));

afterEach(cleanup);
function MySquads() { const { search } = useLocation(); return <h1>My squads{search}</h1>; }
const mount = (at = '/clubs/7/office') => render(<MemoryRouter initialEntries={[at]}><Routes>
    <Route path="/clubs/:id/office" element={<ClubOffice clubId={7} sessionId={'fixture' as AuthSessionId} />} />
    <Route path="/my-squads" element={<MySquads />} />
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

// A head coach of squad 105 who isn't an admin, with Attendance; and an owner who also coaches 105.
const coachCan: Can = { pending: false, failed: false, decide: action => ({ allowed: action !== 'invite_staff' }) };
const ownerCan: Can = { pending: false, failed: false, decide: () => ({ allowed: true }) };
const onSquad = (onSquads = true) => ({ data: { views: [{ id: 'job', label: 'Head coach', modules: ['ATTENDANCE'], squadIds: [105], clubWide: false, onSquads }] } as unknown, loading: false, error: null, refresh: vi.fn() });
const attendance = { clubId: 7, clubName: 'Club', leadership: false, settings: { enabled_modules: ['ATTENDANCE'] },
    modules: [{ id: 'ATTENDANCE', writable: true, globalWrite: false, writeSquads: [105], readSquads: [105], globalRead: false }] } as unknown;

it('sends a coach’s bare link for their own squad to My squads; another squad, a session, the way back or a record stays here', () => {
    loads.can = coachCan;
    loads.roles = onSquad();
    loads.operations = { ...loads.operations, boot: attendance };
    for (const [query, shown] of [
        ['tool=attendance&squad=105', 'My squads?clubId=7&tab=calendar&squad=105'],
        ['tool=applications', 'My squads?clubId=7&tab=players'],
        ['tool=attendance&squad=106', 'Tool attendance'],
        ['tool=attendance&squad=105&session=33', 'Tool attendance'],
        ['tool=attendance&squad=105&return=squads', 'Tool attendance'],
        ['tool=attendance&record=12', 'Tool attendance'],
        ['tool=applications&applicationId=3', 'Tool applications'],
    ]) {
        mount(`/clubs/7/office?tab=tools&${query}`);
        expect(screen.getByRole('heading', { name: shown }), query).toBeInTheDocument();
        cleanup();
    }
    loads.roles = onSquad(false);
    mount('/clubs/7/office?tab=tools&tool=attendance');
    expect(screen.getByRole('heading', { name: 'Tool attendance' })).toBeInTheDocument();
    loads.operations = { ...loads.operations, boot: null };
});

it('keeps every tool in Club office for an owner who also coaches a squad', () => {
    loads.can = ownerCan;
    loads.roles = onSquad();
    for (const query of ['tool=attendance&squad=105', 'tool=attendance&squad=106', 'tool=applications', 'tool=preparation']) {
        mount(`/clubs/7/office?tab=tools&${query}`);
        expect(screen.getByRole('heading', { name: /^Tool / }), query).toBeInTheDocument();
        cleanup();
    }
    mount('/clubs/7/office?tab=tools');
    expect(document.getElementById('office-tools-my-squads'), 'More tools lists them for the owner').toBeInTheDocument();
    cleanup();
    loads.can = coachCan;
    loads.operations = { ...loads.operations, boot: attendance };
    mount('/clubs/7/office?tab=tools');
    expect(screen.getByRole('heading', { name: 'More tools' })).toBeInTheDocument();
    expect(document.getElementById('office-tools-my-squads'), 'the coach has them in My squads').not.toBeInTheDocument();
    loads.operations = { ...loads.operations, boot: null };
});

it('keeps setting up joining here: every admissions link opens the tool, for someone on a squad too', () => {
    loads.can = { pending: false, failed: false, decide: () => ({ allowed: true }) };
    loads.roles = { data: { views: [{ id: 'job', label: 'Head coach', modules: [], squadIds: [105], clubWide: false, onSquads: true }] } as unknown, loading: false, error: null, refresh: vi.fn() };
    for (const query of ['', '&inquiryId=9', '&caseId=3', '&inquiryId=9&joiningSetup=1', '&admissionView=groups&group=4']) {
        mount(`/clubs/7/office?tab=tools&tool=admissions${query}`);
        expect(screen.getByRole('heading', { name: 'Tool admissions' }), query).toBeInTheDocument();
        cleanup();
    }
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
