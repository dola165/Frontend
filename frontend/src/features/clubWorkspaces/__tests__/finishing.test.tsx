import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import ClubJobWorkspacePage from '../../../pages/ClubJobWorkspacePage';
import type { WorkspaceOperations } from '../../clubOperations/WorkspaceOperations';
import { workspaceNavKa } from '../../../locales/workspaceDesign';
import { bootstrap, desk, manifest, moduleScope, roles } from './fixtures';
import type { JobWorkspaceManifest } from '../types';

const mocks = vi.hoisted(() => ({ get: vi.fn(), boot: null as unknown, roles: null as unknown }));
const auth = vi.hoisted(() => ({ isAuthenticated: true, sessionId: '', user: { id: 9 } }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: mocks.get } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../clubOperations/useClubOperations', () => ({ useClubOperations: () => ({ boot: mocks.boot, loading: false, error: '', refresh: async () => undefined }) }));
vi.mock('../../clubOperations/useWorkspaceRoles', () => ({ useWorkspaceRoles: () => ({ data: mocks.roles, loading: false, error: '', refresh: () => undefined }) }));
vi.mock('../../clubOperations/WorkspaceOperations', () => ({ WorkspaceOperations: (props: Parameters<typeof WorkspaceOperations>[0]) => <Tool {...props} /> }));
vi.mock('../../scouting/Scouting', () => ({ Scouting: () => <div>Canonical scouting records</div> }));

function Tool({ origin }: Parameters<typeof WorkspaceOperations>[0]) {
    const [draft, setDraft] = useState('');
    return <><label>Actor draft<input value={draft} onChange={event => setDraft(event.target.value)} /></label><button onClick={origin?.onBack}>{origin?.label}</button></>;
}
function OtherClub() { const navigate = useNavigate(); return <button onClick={() => navigate('/clubs/8/work')}>Other club</button>; }
function App({ path = '/clubs/7/work' }: { path?: string }) {
    return <MemoryRouter initialEntries={[path]}><OtherClub /><Routes>
        <Route path="/clubs/:id/work/:workspace?" element={<ClubJobWorkspacePage />} />
        <Route path="/clubs/:id/office" element={<h1>Canonical Staff</h1>} />
        <Route path="/clubs/:id" element={<h1>Canonical club page</h1>} />
        <Route path="/world/matches" element={<h1>Canonical matches</h1>} />
    </Routes></MemoryRouter>;
}
let response: JobWorkspaceManifest, generation = 0;
let access: () => Promise<unknown>;
const office = () => ({ ...desk('office', []), title: 'Club office', path: '/clubs/7/office', maturity: 'working' as const });
const row = () => ({ id: 18, club_id: 7, module: 'FINANCE', title: 'Alex: Money – გადასახადი', status: 'DUE', squad_id: 2, due_on: '2026-11-02' });
beforeEach(async () => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    await i18n.changeLanguage('en');
    auth.isAuthenticated = true; auth.sessionId = `finishing-${++generation}`; auth.user = { id: 9 };
    localStorage.setItem('gk-session-id', auth.sessionId);
    response = manifest(); mocks.boot = bootstrap(); mocks.roles = roles();
    access = async () => ({ data: { allowed: [], refused: [] } });
    mocks.get.mockImplementation(async (url: string) => {
        if (url.endsWith('/job-workspaces')) return { data: response };
        if (url.startsWith('/access/clubs/')) return access();
        if (url.startsWith('/clubs/7/workspace-roles/work?')) return { data: [row()] };
        throw new Error('Unexpected finishing test request: ' + url);
    });
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

it.each([
    ['en', 'Your club work', 'Preview job workspaces', 'Prototype', 'Money', 'Inbox'],
    ['ka', 'თქვენი სამუშაო კლუბში', 'სამუშაო სივრცეების წინასწარი ნახვა', 'პროტოტიპი', 'ფინანსები', 'შემოსულები'],
])('localizes the index in %s while preserving typed club and job names', async (language, title, previewLabel, badge, money, inbox) => {
    await i18n.changeLanguage(language);
    response.clubName = 'FC Dinamo – Alex-ის აკადემია'; response.workspaces[0].jobTitles = ['Money', 'Owner', 'Alex-ის მოვალეობა'];
    render(<App />);
    await screen.findByRole('heading', { name: title });
    const summary = screen.getByText(previewLabel), preview = within(summary.closest('details')!);
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(preview.getByText(badge)).toBeInTheDocument(); expect(preview.getByText(money, { selector: 'strong' })).toBeInTheDocument();
    for (const name of ['Money', 'Owner', 'Alex-ის მოვალეობა']) expect(preview.getByText(name, { selector: '.job-workspaces__jobs > span' })).toBeInTheDocument();
    expect(screen.getAllByText(response.clubName).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: inbox })).toHaveAttribute('href', '/requests');
    expect(screen.queryByRole('link', { name: /Colleagues|კოლეგები/ })).not.toBeInTheDocument();
});

it('uses shared Georgian operation labels and preserves authored source record titles', async () => {
    await i18n.changeLanguage('ka'); render(<App path="/clubs/7/work/money?squad=2&session=6&person=4" />);
    await screen.findByLabelText('Actor draft');
    expect(screen.getByRole('link', { name: workspaceNavKa.finance })).toHaveAttribute('aria-current', 'page');
    const waiting = await screen.findByRole('region', { name: 'თქვენ გელოდებათ' });
    const current = within(waiting).getByRole('link', { name: /Alex: Money – გადასახადი/ });
    expect(current).toHaveAttribute('href', '/clubs/7/work/money?squad=2&session=6&person=4&tool=finance&record=18');
    expect(screen.queryByText(/მიმდინარე საქმეები/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ნაჩვენებია მაქსიმუმ ხუთი/)).not.toBeInTheDocument();
});

it('switches language without refetching authority, changing tool context or losing a draft', async () => {
    render(<App path="/clubs/7/work/money?tool=finance&squad=2&person=4&session=6" />);
    await screen.findByLabelText('Actor draft'); fireEvent.change(screen.getByLabelText('Actor draft'), { target: { value: 'Money – Alex-ის მონახაზი' } });
    const before = mocks.get.mock.calls.length;
    await act(async () => { await i18n.changeLanguage('ka'); });
    expect(screen.queryByRole('button', { name: 'უკან: მიმოხილვა' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Actor draft')).toHaveValue('Money – Alex-ის მონახაზი');
    expect(mocks.get.mock.calls).toHaveLength(before);
    expect(screen.getByRole('link', { name: workspaceNavKa.finance })).toHaveAttribute('aria-current', 'page');
});

it('opens Scouting on its own records, in Georgian, without a shared work request', async () => {
    await i18n.changeLanguage('ka'); response = manifest([desk('scouting', [moduleScope('SCOUTING')])]);
    render(<App path="/clubs/7/work/scouting" />);
    await screen.findByText('Canonical scouting records');
    expect(screen.getByRole('link', { name: 'სკაუტინგი' })).toHaveAttribute('aria-current', 'page');
    expect(mocks.get.mock.calls.some(([url]) => String(url).includes('workspace-roles/work'))).toBe(false);
});

it.each([['media', 'Canonical club page'], ['matches', 'Canonical matches']] as const)('%s opens where that work already happens, with no Overview of links', async (key, heading) => {
    await i18n.changeLanguage('ka'); response = manifest([desk(key, [moduleScope('MATCHES')])]); render(<App path={`/clubs/7/work/${key}`} />);
    await screen.findByRole('heading', { name: heading });
    expect(screen.queryByText('სამუშაო სივრცის საცდელი ვერსია · ინსტრუმენტებზე არსებული უფლებები მოქმედებს')).not.toBeInTheDocument();
});

it('localizes fallback failures and invalid destinations without translating server-authored explanations', async () => {
    await i18n.changeLanguage('ka'); mocks.get.mockRejectedValueOnce(new Error('Internal error'));
    render(<App />); expect(await screen.findByRole('alert')).toHaveTextContent('კლუბში თქვენი სამუშაო სივრცეები ვერ ჩაიტვირთა.');
    fireEvent.click(screen.getByRole('button', { name: 'თავიდან' }));
    await screen.findByText('სამუშაო სივრცეების წინასწარი ნახვა'); cleanup();
    render(<App path="/clubs/7/work/money?tool=medical" />);
    await screen.findByText('ეს ინსტრუმენტი ამ სამუშაო სივრცეში ხელმისაწვდომი არ არის'); cleanup();
    mocks.get.mockRejectedValueOnce({ response: { data: { detail: 'Alex-ის განაცხადი: needs review' } } }); render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Alex-ის განაცხადი: needs review');
});

it('offers canonical Staff to an explicit see_staff allow even without an office manifest entry', async () => {
    access = async () => ({ data: { allowed: ['see_staff'], refused: [] } }); render(<App />);
    const link = await screen.findByRole('link', { name: 'Colleagues' });
    expect(response.workspaces.some(workspace => workspace.key === 'office')).toBe(false);
    expect(link).toHaveAttribute('href', '/clubs/7/office'); fireEvent.click(link);
    await screen.findByRole('heading', { name: 'Canonical Staff' });
});

it.each(['missing', 'denied', 'failure', 'unavailable'] as const)('does not infer Colleagues from the manifest or job titles when see_staff is %s', async state => {
    response = manifest([office(), desk()]); response.workspaces[1].jobTitles = ['Owner', 'see_staff', 'Scout'];
    access = state === 'failure' ? async () => { throw new Error('Offline'); }
        : state === 'unavailable' ? async () => { throw { isAxiosError: true, response: { status: 404 } }; }
            : async () => ({ data: { allowed: state === 'denied' ? ['invite_staff'] : [], refused: state === 'denied' ? [{ action: 'see_staff', reason: 'ONLY_STAFF', message: null }] : [] } });
    render(<App />); await screen.findByRole('heading', { name: 'Your club work' });
    await waitFor(() => expect(mocks.get.mock.calls.some(([url]) => url === '/access/clubs/7')).toBe(true));
    expect(screen.queryByRole('link', { name: 'Colleagues' })).not.toBeInTheDocument();
});

it('hides Colleagues while its explicit answer is pending, then follows the current answer', async () => {
    let answer!: (value: unknown) => void; access = () => new Promise(resolve => { answer = resolve; }); render(<App />);
    await screen.findByRole('heading', { name: 'Your club work' });
    await waitFor(() => expect(answer).toBeTypeOf('function'));
    expect(screen.queryByRole('link', { name: 'Colleagues' })).not.toBeInTheDocument();
    await act(async () => { answer({ data: { allowed: ['see_staff'], refused: [] } }); });
    expect(screen.getByRole('link', { name: 'Colleagues' })).toBeInTheDocument();
});

it('does not carry an old club’s staff allow into a different club', async () => {
    access = async () => ({ data: { allowed: ['see_staff'], refused: [] } }); render(<App />); await screen.findByRole('link', { name: 'Colleagues' });
    let answer!: (value: unknown) => void;
    access = () => new Promise(resolve => { answer = resolve; }); response = { ...manifest([]), clubId: 8 };
    fireEvent.click(screen.getByRole('button', { name: 'Other club' })); await screen.findByRole('heading', { name: 'Your club work' });
    await waitFor(() => expect(answer).toBeTypeOf('function'));
    expect(screen.queryByRole('link', { name: 'Colleagues' })).not.toBeInTheDocument();
    await act(async () => { answer({ data: { allowed: [], refused: [] } }); });
    expect(screen.queryByRole('link', { name: 'Colleagues' })).not.toBeInTheDocument();
});

it('ignores an old actor’s late staff allow after a session switch', async () => {
    let oldAnswer!: (value: unknown) => void; access = () => new Promise(resolve => { oldAnswer = resolve; });
    const view = render(<App />); await screen.findByRole('heading', { name: 'Your club work' });
    await waitFor(() => expect(oldAnswer).toBeTypeOf('function'));
    auth.sessionId = 'replacement-actor'; auth.user = { id: 10 }; response = { ...manifest(), actorId: 10 };
    access = async () => ({ data: { allowed: [], refused: [] } }); localStorage.setItem('gk-session-id', auth.sessionId);
    act(() => window.dispatchEvent(new Event('gk-auth-changed'))); view.rerender(<App />);
    await screen.findByRole('heading', { name: 'Your club work' });
    await act(async () => { oldAnswer({ data: { allowed: ['see_staff'], refused: [] } }); });
    expect(screen.queryByRole('link', { name: 'Colleagues' })).not.toBeInTheDocument();
});
