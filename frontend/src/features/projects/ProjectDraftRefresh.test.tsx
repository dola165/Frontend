import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useProject } from './useProjects';
import { ProjectEditDialog } from './ProjectEditDialog';
import { ProjectMoney } from './ProjectMoney';
import type { ProjectDetail, ProjectFundraiser } from './api';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
vi.mock('../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (en: string) => en }));
const fundraiser = (): ProjectFundraiser => ({
    id: 9, version: 3, status: 'PUBLISHED', phase: 'ACTIVE', donateUrl: null, goal: { amount: 200, currency: 'GEL' },
    reportedAmount: 50, reportedNote: '', reportedBy: null, reportedAt: null, publishedBy: null,
    publishedAt: '2026-10-30T10:00:00Z', clubVerified: true, publicNow: true, currency: 'GEL',
    summary: 'Original appeal', description: 'Original scope', beneficiary: 'The club', useOfFunds: 'Nets',
    category: 'FACILITIES', startsOn: null, endsOn: null, images: [],
});
function initial(): ProjectDetail {
    return {
        summary: { id: 5, goal: 'Original net repair', status: 'NOW', squad: null, dueOn: null,
            target: { amount: 200, currency: 'GEL' }, raised: 50, progress: 25, progressFromMoney: true,
            stepsDone: 0, stepsTotal: 0, nextStep: null, people: [], waitingOnMe: 0,
            fundraiserStatus: 'PUBLISHED', updatedAt: '2026-10-31T00:00:00Z' },
        purpose: 'Original scope', version: 1, startedBy: null, steps: [], talk: [], files: [], history: [],
        fundraiser: fundraiser(), can: { change: true, addPeople: true, talk: true, startFundraiser: true, publish: true },
        club: { id: 400, name: 'Dinamo synthetic', crestUrl: null }, choices: { squads: [], people: [] },
    };
}
let canonical: ProjectDetail;
let accepted: number;
const conflict = () => Promise.reject({ response: { status: 409, data: { message: 'Changed meanwhile. Review the current record.' } } });
function Harness() {
    const read = useProject(5);
    const [editing, setEditing] = useState(false);
    if (!read.data) return <p>Project unavailable</p>;
    return <>
        <output aria-label="Current project">{read.data.summary.goal} · {read.data.version}</output>
        <output aria-label="Current fundraiser">{read.data.fundraiser?.summary ?? 'None'} · {read.data.fundraiser?.version}</output>
        <button onClick={() => setEditing(true)}>Edit project</button>
        {editing && <ProjectEditDialog project={read.data} onClose={() => setEditing(false)} onSaved={read.put} />}
        <ProjectMoney project={read.data} onChanged={read.put} />
    </>;
}
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('gk-session-id', crypto.randomUUID());
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    canonical = initial(); accepted = 0;
    api.get.mockImplementation(async () => ({ data: structuredClone(canonical) }));
    api.patch.mockImplementation(async (_path: string, input: { version: number; goal: string; purpose: string }) => {
        if (input.version !== canonical.version) return conflict();
        accepted++; canonical = { ...canonical, purpose: input.purpose, version: canonical.version + 1,
            summary: { ...canonical.summary, goal: input.goal } };
        return { data: structuredClone(canonical) };
    });
    const mutate = async (path: string, input: { version?: number } & Record<string, unknown>) => {
        if (input.version === undefined && canonical.fundraiser) return conflict();
        if (input.version !== canonical.fundraiser?.version) return conflict();
        accepted++;
        if (path.endsWith('/state') && input.status === 'ARCHIVED') canonical.fundraiser!.status = 'ARCHIVED';
        else Object.assign(canonical.fundraiser!, input);
        canonical.fundraiser!.version++;
        return { data: structuredClone(canonical) };
    };
    api.post.mockImplementation(mutate); api.put.mockImplementation(mutate);
});
afterEach(cleanup);
const mount = () => render(<MemoryRouter><Harness /></MemoryRouter>);
async function colleagueThenFocus(fundraiserOver: Partial<ProjectFundraiser> = {}) {
    canonical = { ...canonical, version: 2, purpose: 'Revised by colleague',
        summary: { ...canonical.summary, goal: 'Updated ground repair' },
        fundraiser: { ...fundraiser(), version: 4, summary: 'Colleague appeal', reportedAmount: 75, ...fundraiserOver } };
    act(() => fireEvent.focus(window));
    await waitFor(() => expect(screen.getByLabelText('Current project')).toHaveTextContent('Updated ground repair · 2'));
    expect(screen.getByLabelText('Current fundraiser')).toHaveTextContent('Colleague appeal · 4');
}
const rejected = async () => {
    expect(await screen.findByRole('alert')).toHaveTextContent('Changed meanwhile');
    expect(accepted).toBe(0);
    expect(canonical.summary.goal).toBe('Updated ground repair');
    expect(canonical.fundraiser?.summary).toBe('Colleague appeal');
    expect(screen.getByLabelText('Current project')).toHaveTextContent('Updated ground repair · 2');
};

it('G4-S2 keeps the actual project draft version and fields across an authoritative focus refresh', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Edit project' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), { target: { value: 'My unsaved repair' } });
    await colleagueThenFocus();
    expect(screen.getByRole('textbox', { name: 'Goal' })).toHaveValue('My unsaved repair');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await rejected();
    expect(api.patch.mock.calls[0][1]).toMatchObject({ version: 1, goal: 'My unsaved repair', purpose: 'Original scope' });
    expect(screen.getByRole('textbox', { name: 'Goal' })).toHaveValue('My unsaved repair');
});

it('G4-S2 keeps fundraiser words tied to their opening version', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Edit fundraiser' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'In one line' }), { target: { value: 'My unsaved appeal' } });
    await colleagueThenFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await rejected();
    expect(api.put.mock.calls[0][1]).toMatchObject({ version: 3, summary: 'My unsaved appeal' });
    expect(screen.getByRole('textbox', { name: 'In one line' })).toHaveValue('My unsaved appeal');
});

it('G4-S2 keeps an amount report tied to its original amount and currency context', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Update amount' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Raised so far' }), { target: { value: '125' } });
    await colleagueThenFocus({ currency: 'USD' });
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveValue('GEL');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await rejected();
    expect(api.post.mock.calls[0][1]).toMatchObject({ version: 3, amount: 125 });
    expect(screen.getByRole('textbox', { name: 'Raised so far' })).toHaveValue('125');
    expect(canonical.fundraiser?.currency).toBe('USD');
});

it('G4-S2 preserves an update draft and uses the fundraiser version seen when it opened', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Post an update' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Draft update' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Draft details' } });
    await colleagueThenFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await rejected();
    expect(api.post.mock.calls[0][1]).toMatchObject({ version: 3, title: 'Draft update', body: 'Draft details' });
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Draft details');
});

it('G4-S2 does not advance an archive confirmation to a colleague’s new revision', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Take off the site' }));
    await colleagueThenFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Take it off' }));
    await rejected();
    expect(api.post.mock.calls[0][1]).toMatchObject({ version: 3, status: 'ARCHIVED' });
    expect(canonical.fundraiser?.status).toBe('PUBLISHED');
});

it('G4-S2 does not turn a start draft into an edit of a fundraiser another person just created', async () => {
    canonical.fundraiser = null;
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Start a fundraiser' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'In one line' }), { target: { value: 'My new appeal' } });
    await colleagueThenFocus();
    const dialog = screen.getByRole('dialog', { name: 'Start a fundraiser' });
    expect(within(dialog).getByRole('textbox', { name: 'In one line' })).toHaveValue('My new appeal');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start as a draft' }));
    await rejected(); expect(api.put).not.toHaveBeenCalled();
});

it('G4-S2 still retires the draft when the current project read revokes access', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Edit project' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), { target: { value: 'Retired private draft' } });
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    act(() => fireEvent.focus(window));
    await screen.findByText('Project unavailable');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(api.patch).not.toHaveBeenCalled();
});

it('G4-S2 keeps a start draft open when a colleague removes the current money target', async () => {
    canonical.fundraiser = null;
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Start a fundraiser' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'In one line' }), { target: { value: 'Keep this appeal draft' } });
    canonical = { ...canonical, version: 2, summary: { ...canonical.summary, goal: 'Updated ground repair', target: null } };
    act(() => fireEvent.focus(window));
    await waitFor(() => expect(screen.getByLabelText('Current project')).toHaveTextContent('Updated ground repair · 2'));
    expect(screen.getByRole('textbox', { name: 'In one line' })).toHaveValue('Keep this appeal draft');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
});

it('G4-S2 retires an old login’s editor and ignores its delayed authority refresh', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Edit project' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), { target: { value: 'Old login draft' } });
    let resolve!: (response: { data: ProjectDetail }) => void;
    api.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }))
        .mockRejectedValueOnce({ response: { status: 404 } });
    act(() => fireEvent.focus(window));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    await act(async () => {
        localStorage.setItem('gk-session-id', crypto.randomUUID()); window.dispatchEvent(new Event('gk-auth-changed'));
        resolve({ data: initial() });
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
    expect(screen.getByText('Project unavailable')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Old login draft')).not.toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
});
