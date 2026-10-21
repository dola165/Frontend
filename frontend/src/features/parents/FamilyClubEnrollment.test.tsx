import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FamilyClubEnrollment } from './FamilyClubEnrollment';
const api = vi.hoisted(() => ({ previewPlayerLinkCode: vi.fn(), redeemPlayerLinkCode: vi.fn() }));
vi.mock('../joining-contract/api', () => api);
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: null }) }));
const preview = { playerId: 23, playerName: 'Named child', expiresAt: '2026-10-04T18:00:00Z', clubId: 1, existingCaseId: null, existingInquiryId: null, status: 'READY', options: [{ id: 9, version: 2, name: 'U12 training', remainingPlaces: 4, availability: 'PLACES_AVAILABLE' }] };
const receipt = { status: 'LINKED', playerId: 23, caseId: 91, inquiryId: null, staffDestination: '/clubs/1/workspace?tab=admissions&caseId=91' };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); api.previewPlayerLinkCode.mockResolvedValue(preview); api.redeemPlayerLinkCode.mockResolvedValue(receipt); });
const open = () => { const onLinked = vi.fn(); render(<MemoryRouter><FamilyClubEnrollment clubId={1} onLinked={onLinked} /></MemoryRouter>); return onLinked; };
async function check() { fireEvent.change(screen.getByLabelText('Enrollment code'), { target: { value: 'synthetic-secret' } }); fireEvent.click(screen.getByRole('button', { name: 'Check code' })); await screen.findByRole('heading', { name: 'Named child' }); }
it('previews the named player before a separate link command and opens the returned arrangement', async () => {
  const onLinked = open(); await check(); expect(api.redeemPlayerLinkCode).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Group/), { target: { value: '9' } }); fireEvent.click(screen.getByRole('button', { name: 'Continue with this player' }));
  expect(await screen.findByRole('link', { name: 'Open player intake' })).toHaveAttribute('href', receipt.staffDestination);
  expect(api.redeemPlayerLinkCode).toHaveBeenCalledWith(1, expect.objectContaining({ code: 'synthetic-secret', groupId: 9, groupVersion: 2, requestId: expect.any(String) }), null);
  expect(onLinked).toHaveBeenCalledWith(receipt); expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('synthetic-secret');
});
it('retries the same command after a lost response and does not change the intended group', async () => {
  api.redeemPlayerLinkCode.mockRejectedValueOnce(new Error('reply lost')).mockResolvedValue({ ...receipt, status: 'ALREADY_LINKED' });
  open(); await check(); fireEvent.click(screen.getByRole('button', { name: 'Continue with this player' })); await screen.findByRole('alert');
  expect(screen.getByLabelText('Enrollment code')).toBeDisabled(); expect(screen.getByLabelText(/Group/)).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry the same link' })); await screen.findByRole('link', { name: 'Open player intake' });
  expect(api.redeemPlayerLinkCode.mock.calls[1][1]).toEqual(api.redeemPlayerLinkCode.mock.calls[0][1]);
});
it('explains expiry or scope failure without linking a player', async () => {
  api.previewPlayerLinkCode.mockRejectedValue(new Error('Code expired')); open(); fireEvent.change(screen.getByLabelText('Enrollment code'), { target: { value: 'expired-test-code' } }); fireEvent.click(screen.getByRole('button', { name: 'Check code' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(api.redeemPlayerLinkCode).not.toHaveBeenCalled();
});
it('lets group-scoped staff select the agreed group even when another arrangement already exists', async () => {
  api.previewPlayerLinkCode.mockResolvedValue({...preview,existingCaseId:71});
  render(<MemoryRouter><FamilyClubEnrollment clubId={1} onLinked={vi.fn()} canContinueWithoutGroup={false}/></MemoryRouter>);
  await check(); const group=screen.getByLabelText('Group');expect(group).toBeRequired();expect(group).toBeEnabled();
  fireEvent.change(group,{target:{value:'9'}});fireEvent.click(screen.getByRole('button',{name:'Continue with this player'}));
  await screen.findByRole('link',{name:'Open player intake'});
  expect(api.redeemPlayerLinkCode).toHaveBeenCalledWith(1,expect.objectContaining({groupId:9,groupVersion:2}),null);
});
it('recovers an already-used same-club code without choosing a different group', async () => {
  api.previewPlayerLinkCode.mockResolvedValue({...preview,status:'ALREADY_LINKED',existingCaseId:91});
  render(<MemoryRouter><FamilyClubEnrollment clubId={1} onLinked={vi.fn()} canContinueWithoutGroup={false}/></MemoryRouter>);
  await check();expect(screen.getByLabelText(/Group/)).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Continue with this player'}));await screen.findByRole('link',{name:'Open player intake'});
  expect(api.redeemPlayerLinkCode).toHaveBeenCalledWith(1,expect.objectContaining({groupId:null}),null);
});
