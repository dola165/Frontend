import '../../../i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SquadPlayersTab } from './SquadPlayersTab';
import * as api from '../api';

vi.mock('../api', () => ({ joinLink: vi.fn(), createJoinLink: vi.fn(), disableJoinLink: vi.fn(), joinRequests: vi.fn(), decideJoinRequest: vi.fn(), approveAllJoinRequests: vi.fn(), parentLinks: vi.fn(), answerParentLink: vi.fn() }));
vi.mock('../../clubs/api', () => ({ removePlayerFromSquad: vi.fn() }));
const rules = vi.hoisted(() => ({ value: null as null | Record<string, boolean> }));
vi.mock('../../../hooks/useCan', () => ({ useCan: () => ({ pending: false, admin: null, decide: (action: string, fallback: boolean) => ({ allowed: rules.value ? Boolean(rules.value[action]) : fallback }) }) }));
vi.mock('../../clubWorkspace/squads/PlayerCard', () => ({ PlayerCard: ({ player }: { player: { name: string } }) => <div>{player.name}</div> }));

const space = { id: 11, name: 'U12', academy_name: 'Test FC', club_id: 1, can_manage: true, players: [{ id: 41, name: 'Alex' }] } as api.SquadOverview;
const none: api.SquadJoinLink = { squadId: 11, squadName: 'U12', status: 'NONE', code: null, path: null, createdAt: null, createdBy: null, createdByName: null, expiresAt: null, disabledAt: null };
const active: api.SquadJoinLink = { ...none, status: 'ACTIVE', code: 'c'.repeat(43), path: `/join/${'c'.repeat(43)}`, createdAt: '2026-10-19T08:00:00Z', createdBy: 7, createdByName: 'Coach Nino' };
const group: api.SquadJoinGroup = { id: 81, version: 3, name: 'U12 intake', method: 'DIRECT' };
const request = (over: Partial<api.SquadJoinRequest> = {}): api.SquadJoinRequest => ({ id: 62, version: 4, source: 'LINK', playerId: 900, childName: 'Nino Beridze', birthYear: 2016, guardianName: 'Giorgi Beridze', message: null, createdAt: '2026-10-19T09:00:00Z', caseId: null, destination: '/clubs/1/workspace?tab=admissions&inquiryId=62', groups: [group], setup: { canConfigure: false, destination: null }, ...over });

function Address() { const location = useLocation(); return <output data-testid="address">{location.search}</output>; }
const show = (entry = '/squads/11?tab=players&invite=1') => {
    const onChanged = vi.fn();
    render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/squads/:id" element={<><SquadPlayersTab space={space} crest={null} childIds={[]} onChanged={onChanged} /><Address /></>} /></Routes></MemoryRouter>);
    return onChanged;
};
beforeEach(() => {
    vi.clearAllMocks();
    rules.value = null;
    vi.mocked(api.joinLink).mockResolvedValue(none);
    vi.mocked(api.joinRequests).mockResolvedValue([]);
    vi.mocked(api.parentLinks).mockResolvedValue([]);
    vi.stubGlobal('confirm', vi.fn(() => true));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('opens from the address, makes the link once with a request id and shows the URL to copy', async () => {
    vi.mocked(api.createJoinLink).mockResolvedValue(active);
    show();
    expect(await screen.findByText('No link yet.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Join link' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByRole('textbox', { name: 'Join link' })).toHaveValue(`${window.location.origin}${active.path}`);
    expect(api.createJoinLink).toHaveBeenCalledWith(11, { requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(active.path!)));
    expect(screen.getByText(/made by Coach Nino/)).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent('invite=1');
});

it('rotates and switches off only after the coach confirms, and the old URL disappears', async () => {
    vi.mocked(api.joinLink).mockResolvedValue(active);
    vi.mocked(api.disableJoinLink).mockResolvedValue({ ...none, status: 'DISABLED', disabledAt: '2026-10-19T10:00:00Z' });
    show();
    await screen.findByRole('textbox', { name: 'Join link' });
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'New link' }));
    expect(api.createJoinLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Switch off' }));
    await screen.findByText('The link is switched off. Requests already made stay.');
    expect(api.disableJoinLink).toHaveBeenCalledWith(11);
    expect(screen.queryByRole('textbox', { name: 'Join link' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make a new link' })).toBeInTheDocument();
});

it('accepts a waiting child into the squad’s joining group with the reviewed version, then refreshes', async () => {
    vi.mocked(api.joinRequests).mockResolvedValueOnce([request()]).mockResolvedValue([]);
    vi.mocked(api.decideJoinRequest).mockResolvedValue({ inquiryId: 62, outcome: 'PLACE_OFFERED', destination: '/admissions/cases/5' });
    const onChanged = show();
    expect(await screen.findByText('1 waiting to join')).toBeInTheDocument();
    expect(screen.getByText('born 2016 · Giorgi Beridze · from the link')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(api.decideJoinRequest).toHaveBeenCalledWith(11, 62, { requestId: expect.any(String), expectedVersion: 4, action: 'APPROVE', groupId: 81, groupVersion: 3 }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Nobody is waiting.')).toBeInTheDocument();
});

it('points to joining setup instead of accepting when the squad has no joining group, and declines with confirmation', async () => {
    vi.mocked(api.joinRequests).mockResolvedValue([request({ groups: [], setup: { canConfigure: true, destination: '/clubs/1/workspace?tab=admissions&inquiryId=62&joiningSetup=1' } })]);
    vi.mocked(api.decideJoinRequest).mockResolvedValue({ inquiryId: 62, outcome: 'DECLINED', destination: null });
    show();
    expect(await screen.findByRole('link', { name: 'Set up terms' })).toHaveAttribute('href', '/clubs/1/workspace?tab=admissions&inquiryId=62&joiningSetup=1');
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Decline Nino Beridze' }));
    await waitFor(() => expect(api.decideJoinRequest).toHaveBeenCalledWith(11, 62, expect.objectContaining({ action: 'DECLINE', expectedVersion: 4, groupId: null })));
    expect(window.confirm).toHaveBeenCalled();
});

it('shows a failed waiting list and a failed save as errors instead of an empty list', async () => {
    vi.mocked(api.joinRequests).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([request()]);
    vi.mocked(api.decideJoinRequest).mockRejectedValue({ response: { status: 409, data: { code: 'VERSION_CONFLICT', message: 'This request changed. Reload the arrivals before deciding.' } } });
    show();
    expect(await screen.findByText('The waiting list could not load.')).toBeInTheDocument();
    expect(screen.queryByText('Nobody is waiting.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
    expect(await screen.findByText('This request changed. Reload the arrivals before deciding.')).toBeInTheDocument();
});

it('shows the link as a QR code with Copy, WhatsApp and Print', async () => {
    vi.mocked(api.joinLink).mockResolvedValue(active);
    const sheet = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => sheet));
    show();
    expect(await screen.findByTitle('QR code: Join U12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(sheet.document.write).toHaveBeenCalledWith(expect.stringContaining('<svg'));
    expect(sheet.document.write).toHaveBeenCalledWith(expect.stringContaining(`${window.location.origin}${active.path}`));
    expect(sheet.print).toHaveBeenCalled();
});

it('approves everyone the coach sees at once, with the versions seen and the shared group', async () => {
    vi.mocked(api.joinRequests).mockResolvedValueOnce([request(), request({ id: 63, version: 2, childName: 'Luka Kapanadze' })]).mockResolvedValue([]);
    vi.mocked(api.approveAllJoinRequests).mockResolvedValue({ approved: 2, groupName: 'U12 intake', decisions: [] });
    const onChanged = show();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve all 2' }));
    await waitFor(() => expect(api.approveAllJoinRequests).toHaveBeenCalledWith(11, { requestId: expect.stringMatching(/^[0-9a-f-]{36}$/), requests: [{ inquiryId: 62, expectedVersion: 4 }, { inquiryId: 63, expectedVersion: 2 }], groupId: 81, groupVersion: 3 }));
    expect(await screen.findByText('2 offered a place in U12 intake. Families accept the terms next.')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
    expect(await screen.findByText('Nobody is waiting.')).toBeInTheDocument();
});

it('lists a parent asking to be linked; the coach links only a child with no parent yet', async () => {
    vi.mocked(api.parentLinks).mockResolvedValueOnce([
        { id: 5, childName: 'Luka Beridze', requesterName: 'Nino Kapanadze', createdAt: '2026-10-23T09:00:00Z', canLink: false },
        { id: 6, childName: 'Ana Gelashvili', requesterName: 'Dato Gelashvili', createdAt: '2026-10-23T09:00:00Z', canLink: true },
    ]).mockResolvedValue([]);
    vi.mocked(api.answerParentLink).mockResolvedValue({ id: 6, outcome: 'LINKED' });
    show();
    expect(await screen.findByText('Luka’s parent confirms them.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Link' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(api.answerParentLink).toHaveBeenCalledWith(11, 6, true));
});

it('someone who may answer requests but not manage the link sees who is waiting, without the link', async () => {
    rules.value = { approve_join_requests: true };
    vi.mocked(api.joinRequests).mockResolvedValue([request()]);
    show();
    expect(await screen.findByRole('dialog', { name: 'Waiting to join' })).toBeInTheDocument();
    expect(await screen.findByText('Nino Beridze')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create link|New link/ })).not.toBeInTheDocument();
    expect(api.joinLink).not.toHaveBeenCalled();
});
