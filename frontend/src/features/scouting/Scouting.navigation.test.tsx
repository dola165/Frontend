import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Scouting } from './Scouting';
import { AdmissionInquiryPage } from '../admissions/applicant/AdmissionInquiryPage';
import type { Prospect } from './api';
import type { AdmissionInquiry } from '../admissions/types';

const mocks = vi.hoisted(() => ({ scope: vi.fn(), list: vi.fn(), adults: vi.fn(), applications: vi.fn(), get: vi.fn(), watch: vi.fn(), command: vi.fn(), contact: vi.fn(), read: vi.fn(), post: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 7 }, sessionId: 'scouting-navigation' }));
vi.mock('./api', () => ({ scoutingApi: () => mocks }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: mocks.read, post: mocks.post } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
let record: Prospect, inquiry: AdmissionInquiry;
const start = '/clubs/1/office?tab=tools&tool=scouting&squad=2&view=watch&prospect=11';
const familyRoot = '/clubs/1/scouting/11/applications/41';
const refused = (status = 403) => ({ isAxiosError: true, response: { status, data: { detail: 'Current application or family authority unavailable.' } } });
beforeEach(() => {
    vi.resetAllMocks(); auth.sessionId = 'scouting-navigation'; auth.user = { id: 7 };
    localStorage.setItem('gk-session-id', auth.sessionId);
    record = { id: 11, squadId: 2, personId: 9, name: 'Synthetic adult', source: 'PUBLIC_ADULT', applicationId: null, sourceStatus: 'PUBLIC_ADULT', status: 'WATCHING', outcome: null, revision: 0, restricted: false,
        actions: ['OBSERVE', 'FOLLOW_UP', 'NO_FURTHER_ACTION', 'CONTACT'], observations: [], history: [] };
    inquiry = { id: 41, version: 4, playerId: 9, playerName: 'Synthetic child', organizationId: 3, organizationName: 'Synthetic academy', status: 'ROUTED', message: 'The original family applied.', caseId: 61,
        actions: ['MESSAGE', 'RESOLVE'], history: [], createdAt: '2026-10-30T08:00:00Z', updatedAt: '2026-10-30T08:00:00Z', conversationId: 44, conversationDestination: '/messages?conversationId=44', continuation: { applicant: false, staff: true, destination: '/clubs/1/office' } };
    mocks.scope.mockResolvedValue({ clubWide: false, squads: [{ id: 2, name: 'Current squad' }] });
    mocks.get.mockImplementation(async () => ({ ...record }));
    mocks.read.mockImplementation(async (url: string) => { if (url !== familyRoot) throw new Error('Unexpected route ' + url); return { data: { ...inquiry } }; });
    mocks.post.mockImplementation(async (_url, body) => {
        inquiry = { ...inquiry, version: 5, history: [{ id: 81, action: 'MESSAGE', message: body.message, actorName: 'Current intake worker', createdAt: '2026-10-30T09:00:00Z' }] };
        return { data: inquiry };
    });
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); window.dispatchEvent(new Event('gk-auth-changed')); });
function Elsewhere({ title }: { title: string }) { const navigate = useNavigate(); return <><h1>{title}</h1><button onClick={() => navigate(-1)}>Return</button></>; }
function Office() { const [params] = useSearchParams(); return params.get('tool') === 'scouting' ? <Scouting clubId={1} sessionId={auth.sessionId} /> : <Elsewhere title="Existing club tool" />; }
function App() { return <Routes>
    <Route path="/clubs/:club/office" element={<Office />} />
    <Route path="/profile/:id" element={<Elsewhere title="Public player profile" />} />
    <Route path="/admissions/inquiries/:inquiryId" element={<AdmissionInquiryPage />} />
    <Route path="/messages" element={<h1>Unexpected unadmitted room</h1>} />
</Routes>; }
const mount = () => render(<MemoryRouter initialEntries={[start]}><App /></MemoryRouter>);
async function writeObservation() {
    fireEvent.change(await screen.findByLabelText('Football observation'), { target: { value: 'Unsaved match observation' } });
    fireEvent.change(screen.getByLabelText('Observed on'), { target: { value: '2026-10-29' } });
    fireEvent.change(screen.getByLabelText('Match, session or source'), { target: { value: 'Actual Saturday match' } });
}
function family() { record = { ...record, source: 'FAMILY_APPLICATION', name: 'Synthetic child', applicationId: 41, sourceStatus: 'REQUEST_RECEIVED', actions: ['OBSERVE', 'FOLLOW_UP', 'NO_FURTHER_ACTION'] }; }
async function openFamily() { fireEvent.click(await screen.findByRole('link', { name: 'Open family application' })); await screen.findByRole('heading', { name: 'Family application conversation' }); }
async function compose(text = 'Please discuss the actual application with the family.') {
    fireEvent.click(await screen.findByText('Send more information', { selector: 'summary' }));
    fireEvent.change(screen.getByLabelText('Message or reason'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Send more information' }));
}

it('profile click asks; keep editing retains the draft and explicit discard allows real navigation and return', async () => {
    mount(); await writeObservation();
    fireEvent.click(screen.getByRole('link', { name: 'Public profile' }));
    await screen.findByRole('group', { name: 'Discard edits' });
    expect(screen.queryByRole('heading', { name: 'Public player profile' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Football observation')).toHaveValue('Unsaved match observation');
    fireEvent.click(screen.getByRole('link', { name: 'Public profile' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard edits' }));
    await screen.findByRole('heading', { name: 'Public player profile' });
    fireEvent.click(screen.getByRole('button', { name: 'Return' }));
    expect(await screen.findByLabelText('Football observation')).toHaveValue('');
});

it.each(['Tryouts', 'Representation and club approaches'])('guards the retained %s exit and performs the selected click after discard', async label => {
    mount(); await writeObservation();
    fireEvent.click(screen.getByRole('link', { name: label }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard edits' }));
    await screen.findByRole('heading', { name: 'Existing club tool' });
});

it('busy save vetoes same-tab retirement, then permits profile navigation after completion', async () => {
    let complete!: (value: Prospect) => void;
    mocks.command.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    mount(); await writeObservation(); fireEvent.click(screen.getByRole('button', { name: 'Save to record' }));
    fireEvent.click(screen.getByRole('link', { name: 'Public profile' }));
    expect(screen.queryByRole('heading', { name: 'Public player profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Discard edits' })).not.toBeInTheDocument();
    await act(async () => { complete(record); });
    fireEvent.click(await screen.findByRole('link', { name: 'Public profile' }));
    await screen.findByRole('heading', { name: 'Public player profile' });
});

it('unknown command survives profile click, explicit retirement and routed remount with the identical payload and identity', async () => {
    mocks.command.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce(record);
    mount(); await writeObservation(); fireEvent.click(screen.getByRole('button', { name: 'Save to record' }));
    await screen.findByRole('button', { name: 'Retry saved action' });
    const original = structuredClone(mocks.command.mock.calls[0]);
    fireEvent.click(screen.getByRole('link', { name: 'Public profile' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard edits' }));
    await screen.findByRole('heading', { name: 'Public player profile' });
    record = { ...record, revision: 8 };
    fireEvent.click(screen.getByRole('button', { name: 'Return' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry saved action' }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(2));
    expect(mocks.command.mock.calls[1]).toEqual(original);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry saved action' })).not.toBeInTheDocument());
});

it('actual inquiry consumer composes a family command for the nonparticipant intake worker and returns to the selected scouting record', async () => {
    family(); mount(); await writeObservation();
    fireEvent.click(screen.getByRole('link', { name: 'Open family application' }));
    expect(mocks.read).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Discard edits' }));
    await screen.findByText('Send more information', { selector: 'summary' });
    expect(screen.queryByRole('heading', { name: 'Unexpected unadmitted room' })).not.toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
    await compose();
    await screen.findByText('Please discuss the actual application with the family.', { selector: 'p' });
    expect(mocks.post).toHaveBeenCalledWith(familyRoot + '/commands', { requestId: expect.any(String), expectedVersion: 4, action: 'MESSAGE', message: 'Please discuss the actual application with the family.' }, expect.objectContaining({ _authSessionId: auth.sessionId }));
    expect(mocks.contact).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Return to Scouting' }));
    await screen.findByText('Synthetic child');
    expect(await screen.findByLabelText('Team scope')).toHaveValue('2');
    expect(screen.getByLabelText('Football observation')).toHaveValue('');
});

it('family saved-command return/remount retries exactly and current refusal clears protected history without a child fallback', async () => {
    family(); mocks.post.mockRejectedValueOnce(new Error('unknown response')).mockRejectedValueOnce(refused());
    mount(); await openFamily(); await compose('Saved family question');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry saved response' })).toBeEnabled());
    const original = structuredClone(mocks.post.mock.calls[0]);
    fireEvent.click(screen.getByRole('link', { name: 'Return to Scouting' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard edits' }));
    await openFamily();
    fireEvent.click(await screen.findByText('Send more information', { selector: 'summary' }));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.read.mockRejectedValue(refused());
    fireEvent.click(await screen.findByRole('button', { name: 'Retry saved response' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls[1]).toEqual(original);
    await screen.findByText('Current application or family authority unavailable.');
    expect(screen.queryByText('The original family applied.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Message or reason')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Unexpected unadmitted room' })).not.toBeInTheDocument();
    expect(mocks.contact).not.toHaveBeenCalled();
});

it('an account change cannot recover the prior login pending scouting command', async () => {
    mocks.command.mockRejectedValue(new Error('unknown'));
    const app = mount(); await writeObservation(); fireEvent.click(screen.getByRole('button', { name: 'Save to record' }));
    await screen.findByRole('button', { name: 'Retry saved action' });
    auth.sessionId = 'new-scouting-login'; auth.user = { id: 8 }; localStorage.setItem('gk-session-id', auth.sessionId);
    act(() => window.dispatchEvent(new Event('gk-auth-changed')));
    app.rerender(<MemoryRouter initialEntries={[start]}><App /></MemoryRouter>);
    await screen.findByLabelText('Football observation');
    expect(screen.queryByRole('button', { name: 'Retry saved action' })).not.toBeInTheDocument();
    expect(mocks.command).toHaveBeenCalledTimes(1);
});
