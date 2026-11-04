import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PublicJobResponses, MyJobResponses } from '../PublicJobResponses';
import { JobResponseCard } from '../JobResponseCard';
import { JobApplication } from '../../clubs/jobDetail/JobApplication';
import * as api from '../responsesApi';
import type { Job } from '../api';

const auth = vi.hoisted(() => ({ status: 'authenticated', user: { id: 8 } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../responsesApi', () => ({ fetchResponses: vi.fn(), fetchMyResponses: vi.fn(), sendResponse: vi.fn() }));
const job: Job = { id: 101, title: 'Synthetic volunteer', description: 'Synthetic fixture', clubId: null, version: 4, status: 'OPEN', createdAt: '2026-10-30T00:00:00Z', applyMethod: 'IN_APP', requiredRole: null, direction: 'HIRING' };
const receipt: api.JobResponse = { id: 9, jobId: 101, title: job.title, direction: 'HIRING', listingStatus: 'OPEN', terms: { version: 4, description: job.description, category: 'OTHER', engagementType: 'PAID', pay: '100 GEL per session', hours: 'SESSIONS', city: 'Tbilisi' }, offeredListingVersion: null, contactAllowed: true, applicantId: 8, applicantName: 'Synthetic applicant', status: 'SUBMITTED', version: 2, applicant: true, publisher: false, actions: ['REPLY', 'WITHDRAW'], updatedAt: job.createdAt!, events: [{ id: 1, action: 'SUBMIT', side: 'APPLICANT', note: 'Synthetic private note', createdAt: job.createdAt! }] };
const workspace: api.ResponseWorkspace = { publisher: false, canSubmit: true, reason: null, responses: [] };
const open = (listing = job) => render(<MemoryRouter><PublicJobResponses job={listing} /></MemoryRouter>);

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('gk-session-id', 'p2-login'); auth.user = { id: 8 }; auth.status = 'authenticated';
    vi.mocked(api.fetchResponses).mockResolvedValue(workspace);
    vi.mocked(api.fetchMyResponses).mockResolvedValue([]);
    vi.mocked(api.sendResponse).mockResolvedValue(receipt);
});
afterEach(() => vi.restoreAllMocks());

describe('Neutral public work responses', () => {
    it('uses the same neutral response panel from the existing club/World application door', async () => {
        render(<MemoryRouter><JobApplication id={job.id} status="authenticated" detail={{ job, loading: false, error: '', application: null, applicationError: '', checking: false, reload: vi.fn(), setApplication: vi.fn(), retryJob: vi.fn() }} /></MemoryRouter>);
        expect(await screen.findByRole('button', { name: 'Send application' })).toBeInTheDocument();
        expect(screen.queryByText('Contact the club')).not.toBeInTheDocument();
    });
    it('allows an adult to apply with no note, club or football-identity setup', async () => {
        vi.mocked(api.fetchResponses).mockResolvedValueOnce(workspace).mockResolvedValue({ ...workspace, canSubmit: false, responses: [receipt] });
        open();
        fireEvent.click(await screen.findByRole('button', { name: 'Send application' }));
        expect(await screen.findByText('Waiting for a reply')).toBeInTheDocument();
        expect(api.sendResponse).toHaveBeenCalledWith(101, null, { requestId: expect.any(String), expectedVersion: 4, note: '' });
        expect(screen.queryByRole('button', { name: 'Send application' })).not.toBeInTheDocument();
    });
    it('uses enquiry wording for a person offering a service', async () => {
        open({ ...job, direction: 'OFFERING' });
        expect(await screen.findByRole('heading', { name: 'Enquire about this service' })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Send enquiry' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Send application' })).not.toBeInTheDocument();
    });
    it('fails closed on a missing status load and permits a deliberate retry', async () => {
        vi.mocked(api.fetchResponses).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(workspace);
        open(); await screen.findByRole('alert');
        expect(screen.queryByRole('button', { name: 'Send application' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry responses' }));
        expect(await screen.findByRole('button', { name: 'Send application' })).toBeEnabled();
    });
    it('reuses the exact uncertain command after a return and a changed listing version', async () => {
        vi.mocked(api.sendResponse).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValue(receipt);
        const view = open();
        fireEvent.change(await screen.findByLabelText('Note (optional)'), { target: { value: 'Keep my note' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send application' })); await screen.findByRole('alert');
        const command = vi.mocked(api.sendResponse).mock.calls[0][2];
        view.unmount(); open({ ...job, version: 5 });
        fireEvent.click(await screen.findByRole('button', { name: 'Check previous response' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledTimes(2));
        expect(vi.mocked(api.sendResponse).mock.calls[1][2]).toEqual(command);
    });
    it('does not dispatch when recovery storage is unavailable', async () => {
        open(); const note = await screen.findByLabelText('Note (optional)');
        fireEvent.change(note, { target: { value: 'Keep this answer' } });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full'); });
        fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('This attempt was not sent');
        expect(api.sendResponse).not.toHaveBeenCalled(); expect(note).toHaveValue('Keep this answer');
    });
    it.each([
        ['WITHDRAW', 'Withdraw', ['WITHDRAW'], true, false],
        ['OFFER', 'Send offer', ['OFFER', 'DECLINE'], false, true],
        ['ACCEPT', 'Accept offer', ['ACCEPT', 'DECLINE'], true, false],
        ['DECLINE', 'Decline', ['DECLINE'], false, true],
    ] as const)('sends %s only with the server-provided action and response version', async (action, label, actions, applicant, publisher) => {
        const saved = vi.fn();
        render(<MemoryRouter><JobResponseCard response={{ ...receipt, applicant, publisher, actions: [...actions] }} userId={8} onSaved={saved} /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: label }));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(api.sendResponse).toHaveBeenCalledWith(101, 9, expect.objectContaining({ action, expectedVersion: 2, requestId: expect.any(String) }));
    });
    it('requires text for a reply and retains it when the request is uncertain', async () => {
        vi.mocked(api.sendResponse).mockRejectedValue(new Error('Offline'));
        render(<MemoryRouter><JobResponseCard response={receipt} userId={8} onSaved={vi.fn()} /></MemoryRouter>);
        expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Reply or note (optional)'), { target: { value: 'Tuesday works' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send reply' })); await screen.findByRole('alert');
        expect(api.sendResponse).toHaveBeenCalledWith(101, 9, expect.objectContaining({ action: 'REPLY', note: 'Tuesday works' }));
        expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Check previous response' })).toBeInTheDocument();
    });
    it('keeps closed outcomes visible from Jobs without offering another mutation', async () => {
        vi.mocked(api.fetchMyResponses).mockResolvedValue([{ ...receipt, status: 'CLOSED', listingStatus: 'CLOSED', actions: [] }]);
        render(<MemoryRouter><MyJobResponses /></MemoryRouter>);
        expect(await screen.findByText('Listing closed')).toBeInTheDocument();
        expect(screen.getByText('Synthetic private note')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    it('keeps history and withdrawal available without sending an old draft as contact after a block', async () => {
        sessionStorage.setItem('gk-job-response:8:p2-login:101:9', JSON.stringify({ note: 'Draft written before the block' }));
        vi.mocked(api.fetchResponses).mockResolvedValue({ ...workspace, canSubmit: false, responses: [{ ...receipt, contactAllowed: false, actions: ['WITHDRAW'] }] });
        open();
        expect(await screen.findByText('Synthetic private note')).toBeInTheDocument();
        expect(screen.queryByLabelText('Reply or note (optional)')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Send reply' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledOnce());
        expect(api.sendResponse).toHaveBeenCalledWith(101, 9, expect.objectContaining({ action: 'WITHDRAW', note: '' }));
    });
    it('never carries private receipts to another account or late session callback', async () => {
        let resolve!: (data: api.ResponseWorkspace) => void;
        vi.mocked(api.fetchResponses).mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(workspace);
        const view = open();
        auth.user = { id: 18 }; localStorage.setItem('gk-session-id', 'second-login');
        view.rerender(<MemoryRouter><PublicJobResponses job={job} /></MemoryRouter>);
        await act(async () => resolve({ ...workspace, responses: [receipt] }));
        expect(await screen.findByRole('button', { name: 'Send application' })).toBeInTheDocument();
        expect(screen.queryByText('Synthetic private note')).not.toBeInTheDocument();
        expect(api.sendResponse).not.toHaveBeenCalled();
    });
    it.each([
        ['WITHDRAW', false, false], ['DECLINE', true, false],
        ['WITHDRAW', false, true], ['DECLINE', true, true],
    ] as const)('allows deliberate no-note %s after blocked contact (publisher=%s, return=%s)', async (action, publisher, returning) => {
        const initial = { ...receipt, applicant: !publisher, publisher };
        const blocked = { ...initial, version: 7, contactAllowed: false, actions: [action] };
        let finishRead!: (value: api.JobResponse[]) => void;
        const currentRead = new Promise<api.JobResponse[]>(resolve => { finishRead = resolve; });
        if (publisher) vi.mocked(api.fetchResponses).mockResolvedValueOnce({ ...workspace, canSubmit: false, responses: [initial] }).mockImplementationOnce(async () => ({ ...workspace, canSubmit: false, responses: await currentRead }));
        else vi.mocked(api.fetchMyResponses).mockResolvedValueOnce([initial]).mockReturnValueOnce(currentRead);
        vi.mocked(api.sendResponse).mockRejectedValueOnce(returning ? new Error('Lost reply') : { response: { status: 403 } });
        const surface = () => <MemoryRouter>{publisher ? <PublicJobResponses job={{ ...job, canManage: true }} /> : <MyJobResponses />}</MemoryRouter>;
        const view = render(surface());
        fireEvent.change(await screen.findByLabelText('Reply or note (optional)'), { target: { value: 'Preserve exact original contact' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledOnce());
        const original = vi.mocked(api.sendResponse).mock.calls[0][2];
        if (returning) {
            await screen.findByRole('alert');
            view.unmount(); render(surface());
        }
        await screen.findByRole('status');
        expect(screen.queryByRole('button', { name: /without a note/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Synthetic private note')).not.toBeInTheDocument();
        await act(async () => finishRead([blocked]));
        expect(await screen.findByText('Synthetic private note')).toBeInTheDocument();
        expect(screen.queryByLabelText('Reply or note (optional)')).not.toBeInTheDocument();
        const terminal = { ...blocked, status: action === 'WITHDRAW' ? 'WITHDRAWN' : 'DECLINED', version: 8, actions: [] };
        if (publisher) vi.mocked(api.fetchResponses).mockResolvedValue({ ...workspace, canSubmit: false, responses: [terminal] });
        else vi.mocked(api.fetchMyResponses).mockResolvedValue([terminal]);
        fireEvent.click(screen.getByRole('button', { name: `${action === 'WITHDRAW' ? 'Withdraw' : 'Decline'} without a note` }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledTimes(2));
        const resolution = vi.mocked(api.sendResponse).mock.calls[1][2];
        expect(resolution).toEqual({ requestId: expect.any(String), expectedVersion: 7, action, note: '' });
        expect(resolution.requestId).not.toBe(original.requestId);
        expect(await screen.findByText(/Response resolved without a note/)).toBeInTheDocument();
        expect(JSON.parse(sessionStorage.getItem('gk-job-response:8:p2-login:101:9')!).pending).toEqual(original);
        expect(screen.queryByRole('button', { name: /without a note/ })).not.toBeInTheDocument();
        // Explicit recovery still uses the original intent, version, note and request ID.
        fireEvent.click(screen.getByRole('button', { name: 'Check previous response' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledTimes(3));
        expect(vi.mocked(api.sendResponse).mock.calls[2][2]).toEqual(original);
    });
    it('recovers an uncertain no-note resolution separately on return, then respects a current-version conflict', async () => {
        const key = 'gk-job-response:8:p2-login:101:9';
        const original: api.ResponseCommand = { requestId: 'original', expectedVersion: 2, action: 'REPLY', note: 'Keep original' };
        sessionStorage.setItem(key, JSON.stringify({ note: original.note, pending: original }));
        const blocked = { ...receipt, contactAllowed: false, version: 7, actions: ['WITHDRAW'] as api.ResponseAction[] };
        vi.mocked(api.fetchMyResponses).mockResolvedValue([blocked]);
        vi.mocked(api.sendResponse).mockRejectedValueOnce(new Error('Lost resolution')).mockRejectedValueOnce({ response: { status: 409 } });
        const view = render(<MemoryRouter><MyJobResponses /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Withdraw without a note' }));
        await screen.findByRole('alert');
        const resolution = vi.mocked(api.sendResponse).mock.calls[0][2];
        view.unmount();
        vi.mocked(api.fetchMyResponses).mockResolvedValue([{ ...blocked, version: 9 }]);
        render(<MemoryRouter><MyJobResponses /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Check previous resolution' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledTimes(2));
        expect(vi.mocked(api.sendResponse).mock.calls[1][2]).toEqual(resolution);
        expect(await screen.findByRole('alert')).toHaveTextContent('Review the current listing and response');
        expect(JSON.parse(sessionStorage.getItem(key)!).pending).toEqual(original);
        fireEvent.click(screen.getByRole('button', { name: 'Withdraw without a note' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledTimes(3));
        expect(vi.mocked(api.sendResponse).mock.calls[2][2]).toMatchObject({ action: 'WITHDRAW', expectedVersion: 9, note: '' });
        expect(vi.mocked(api.sendResponse).mock.calls[2][2].requestId).not.toBe(resolution.requestId);
    });
    it.each(['SUBMITTED', 'DISCUSSING'])('shows canonical terms before the first offer from %s even when the outer listing is old', async status => {
        const current: api.JobResponse = { ...receipt, publisher: true, applicant: false, status, actions: ['OFFER', 'DECLINE'], terms: { ...receipt.terms, version: 5, description: 'New duties after editor change', pay: '250 GEL per session' } };
        vi.mocked(api.fetchResponses).mockResolvedValueOnce({ ...workspace, canSubmit: false, publisher: true, responses: [current] }).mockResolvedValue({ ...workspace, canSubmit: false, publisher: true, responses: [{ ...current, status: 'OFFERED', version: 3, offeredListingVersion: 5, actions: ['DECLINE'] }] });
        render(<MemoryRouter><p aria-label="Outer listing terms">{job.description}</p><PublicJobResponses job={{ ...job, canManage: true }} /></MemoryRouter>);
        expect(await screen.findByLabelText('Current listing terms')).toHaveTextContent('New duties after editor change');
        expect(screen.getByLabelText('Current listing terms')).toHaveTextContent('250 GEL per session');
        expect(screen.getByLabelText('Outer listing terms')).toHaveTextContent('Synthetic fixture');
        fireEvent.click(screen.getByRole('button', { name: 'Send offer' }));
        await screen.findByText('Offer awaiting your decision');
        expect(api.sendResponse).toHaveBeenCalledWith(101, 9, expect.objectContaining({ action: 'OFFER', expectedListingVersion: 5 }));
        expect(screen.getByLabelText('Current listing terms')).toHaveTextContent('New duties after editor change');
        expect(screen.getByLabelText('Current listing terms')).toHaveTextContent('250 GEL per session');
    });
    it('hides publisher controls immediately when the current authority read fails', async () => {
        vi.mocked(api.fetchResponses).mockResolvedValueOnce({ ...workspace, publisher: true, canSubmit: false, responses: [{ ...receipt, applicant: false, publisher: true, actions: ['OFFER'] }] }).mockRejectedValue(new Error('Access removed'));
        const view = open({ ...job, canManage: true });
        expect(await screen.findByRole('button', { name: 'Send offer' })).toBeInTheDocument();
        view.rerender(<MemoryRouter><PublicJobResponses job={{ ...job, canManage: false }} /></MemoryRouter>);
        await screen.findByRole('alert');
        expect(screen.queryByRole('button', { name: 'Send offer' })).not.toBeInTheDocument();
        expect(screen.queryByText('Synthetic private note')).not.toBeInTheDocument();
    });
    it.each([['listing', 403], ['listing', 404], ['mine', 403], ['mine', 404]] as const)('hides loaded notes after a denied %s mutation (%s) and recovers the exact request only after rechecking access', async (surface, status) => {
        const publisherReceipt = { ...receipt, applicant: false, publisher: true, actions: ['OFFER'] as api.ResponseAction[] };
        const initial = surface === 'listing' ? publisherReceipt : receipt;
        let rejectRead!: (cause: unknown) => void;
        const deniedRead = new Promise<never>((_, reject) => { rejectRead = reject; });
        const reloadListing = vi.fn();
        if (surface === 'listing') vi.mocked(api.fetchResponses).mockResolvedValueOnce({ ...workspace, publisher: true, canSubmit: false, responses: [initial] }).mockReturnValueOnce(deniedRead);
        else vi.mocked(api.fetchMyResponses).mockResolvedValueOnce([initial]).mockReturnValueOnce(deniedRead);
        vi.mocked(api.sendResponse).mockRejectedValueOnce({ response: { status } });
        render(<MemoryRouter>{surface === 'listing' ? <PublicJobResponses job={{ ...job, canManage: true }} onListingChanged={reloadListing} /> : <MyJobResponses />}</MemoryRouter>);
        expect(await screen.findByText('Synthetic private note')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Reply or note (optional)'), { target: { value: 'Exact recovery note' } });
        fireEvent.click(screen.getByRole('button', { name: surface === 'listing' ? 'Send offer' : 'Send reply' }));
        await screen.findByRole('status');
        expect(screen.queryByText('Synthetic private note')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Check previous response' })).not.toBeInTheDocument();
        const key = 'gk-job-response:8:p2-login:101:9';
        const command = vi.mocked(api.sendResponse).mock.calls[0][2];
        expect(JSON.parse(sessionStorage.getItem(key)!).pending).toEqual(command);
        // Reject only after the replacement read has started and attached its error handler.
        await waitFor(() => expect(surface === 'listing' ? api.fetchResponses : api.fetchMyResponses).toHaveBeenCalledTimes(2));
        await act(async () => rejectRead({ response: { status } }));
        await screen.findByRole('alert');
        expect(screen.queryByText('Synthetic private note')).not.toBeInTheDocument();
        if (surface === 'listing') {
            expect(reloadListing).toHaveBeenCalledOnce();
            vi.mocked(api.fetchResponses).mockResolvedValue({ ...workspace, publisher: true, canSubmit: false, responses: [initial] });
        } else vi.mocked(api.fetchMyResponses).mockResolvedValue([initial]);
        // An explicit read succeeds before the pending command becomes available again.
        fireEvent.click(screen.getByRole('button', { name: surface === 'listing' ? 'Retry responses' : 'Retry your responses' }));
        expect(await screen.findByRole('button', { name: 'Recheck access' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Check previous response' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledTimes(2));
        expect(vi.mocked(api.sendResponse).mock.calls[1][2]).toEqual(command);
    });
    it.each([8, 18])('ignores a denied mutation callback after the login changes to user %s and keeps recovery scoped to the original login', async userId => {
        let reject!: (cause: unknown) => void;
        vi.mocked(api.fetchResponses).mockResolvedValueOnce({ ...workspace, canSubmit: false, responses: [receipt] }).mockResolvedValue(workspace);
        vi.mocked(api.sendResponse).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
        const view = open();
        fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
        auth.user = { id: userId }; localStorage.setItem('gk-session-id', 'second-login');
        view.rerender(<MemoryRouter><PublicJobResponses job={job} /></MemoryRouter>);
        await screen.findByRole('button', { name: 'Send application' });
        await act(async () => reject({ response: { status: 403 } }));
        expect(api.fetchResponses).toHaveBeenCalledTimes(2);
        expect(screen.queryByText('Synthetic private note')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Check previous response' })).not.toBeInTheDocument();
        expect(JSON.parse(sessionStorage.getItem('gk-job-response:8:p2-login:101:9')!).pending.action).toBe('WITHDRAW');
    });
    it('shows terms from Jobs and requires a fresh offer after a changed-listing conflict', async () => {
        const offered: api.JobResponse = { ...receipt, status: 'OFFERED', offeredListingVersion: 4, actions: ['ACCEPT', 'DECLINE'] };
        vi.mocked(api.fetchMyResponses).mockResolvedValueOnce([offered]).mockResolvedValueOnce([{ ...offered, terms: { ...offered.terms, version: 5, pay: '50 GEL per session', description: 'Changed session duties' }, actions: ['DECLINE'] }]);
        vi.mocked(api.sendResponse).mockRejectedValueOnce({ response: { status: 409 } });
        const view = render(<MemoryRouter><MyJobResponses /></MemoryRouter>);
        expect(await screen.findByLabelText('Current listing terms')).toHaveTextContent('100 GEL per session');
        expect(screen.getByLabelText('Current listing terms')).toHaveTextContent('Synthetic fixture');
        fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
        await screen.findByText(/publisher must send a fresh offer/);
        expect(screen.queryByRole('button', { name: 'Accept offer' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('Current listing terms')).toHaveTextContent('50 GEL per session');
        expect(api.sendResponse).toHaveBeenCalledWith(101, 9, expect.objectContaining({ action: 'ACCEPT', expectedVersion: 2, expectedListingVersion: 4 }));
        view.unmount();
        vi.mocked(api.fetchMyResponses).mockResolvedValueOnce([{ ...offered, version: 3, offeredListingVersion: 5, terms: { ...offered.terms, version: 5 } }]).mockResolvedValue([{ ...offered, status: 'AGREED', actions: [] }]);
        vi.mocked(api.sendResponse).mockResolvedValue({ ...offered, status: 'AGREED', actions: [] });
        render(<MemoryRouter><MyJobResponses /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Accept offer' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledTimes(2));
        expect(vi.mocked(api.sendResponse).mock.calls[1][2]).toMatchObject({ action: 'ACCEPT', expectedVersion: 3, expectedListingVersion: 5 });
        expect(await screen.findByText('Agreed')).toBeInTheDocument();
    });
    it('reloads the actual listing after a version conflict while retaining the optional note', async () => {
        vi.mocked(api.sendResponse).mockRejectedValueOnce({ response: { status: 409 } });
        const reloadListing = vi.fn();
        const view = render(<MemoryRouter><PublicJobResponses job={job} onListingChanged={reloadListing} /></MemoryRouter>);
        fireEvent.change(await screen.findByLabelText('Note (optional)'), { target: { value: 'Keep after changed listing' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
        await waitFor(() => expect(reloadListing).toHaveBeenCalledOnce());
        view.rerender(<MemoryRouter><PublicJobResponses job={{ ...job, version: 5 }} onListingChanged={reloadListing} /></MemoryRouter>);
        expect(await screen.findByLabelText('Note (optional)')).toHaveValue('Keep after changed listing');
        expect(await screen.findByRole('alert')).toHaveTextContent('Review the current listing');
        vi.mocked(api.sendResponse).mockResolvedValue(receipt);
        fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
        await waitFor(() => expect(api.sendResponse).toHaveBeenCalledTimes(2));
        expect(vi.mocked(api.sendResponse).mock.calls[1][2]).toMatchObject({ expectedVersion: 5, note: 'Keep after changed listing' });
    });
});

describe('Under 18', () => {
    it('says when jobs open and never asks the server for responses', async () => {
        (auth.user as { dob?: string }).dob = `${new Date().getFullYear() - 14}-01-15`;
        open();
        expect(await screen.findByText('Jobs open at 18. Helping your club? Ask your coach.')).toBeInTheDocument();
        expect(api.fetchResponses).not.toHaveBeenCalled();
    });
});
