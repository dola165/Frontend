import '../../i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FamilyLinkPage } from './FamilyLinkPage';
import { claimFamilyLink, previewFamilyLink, type FamilyLinkPreview } from './familyLinks';

const auth = vi.hoisted(() => ({ sessionId: 'anon', isAuthenticated: false, isBootstrapping: false, user: null as null | { fullName: string } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./familyLinks', () => ({ previewFamilyLink: vi.fn(), claimFamilyLink: vi.fn() }));
vi.mock('./api', () => ({ fetchJoiningChildren: vi.fn().mockResolvedValue({ children: [] }) }));

const code = 'f'.repeat(43);
const teen: FamilyLinkPreview = { kind: 'ADD_PARENT', state: 'ACTIVE', personName: 'Luka', askedBy: 'Luka', clubId: null, clubName: null, clubLogoUrl: null, selfPossible: false, expiresAt: '2026-11-09T00:00:00Z' };
const card: FamilyLinkPreview = { ...teen, kind: 'CLUB_CARD', personName: 'Nino', askedBy: 'Koba', clubId: 4, clubName: 'Dinamo Academy' };
const show = () => render(<MemoryRouter initialEntries={[`/family-link/${code}`]}><Routes><Route path="/family-link/:code" element={<FamilyLinkPage />} /></Routes></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); auth.isAuthenticated = false; auth.user = null; });
afterEach(cleanup);

it('shows what the link asks before sign-in, and signing in comes straight back', async () => {
    vi.mocked(previewFamilyLink).mockResolvedValue(teen);
    show();
    expect(await screen.findByText('Luka asks you to be their parent on GrassKickZ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toContain('/login');
    expect(claimFamilyLink).not.toHaveBeenCalled();
});

it('a signed-in parent says yes once they confirm, and lands on the child in Parent Hub', async () => {
    auth.isAuthenticated = true; auth.user = { fullName: 'Tamar Kapanadze' };
    vi.mocked(previewFamilyLink).mockResolvedValue(teen);
    vi.mocked(claimFamilyLink).mockResolvedValue({ outcome: 'LINKED', personId: 31, personName: 'Luka Kapanadze', mergeId: null });
    show();
    const yes = await screen.findByRole('button', { name: 'Yes' });
    expect(yes).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'I’m Luka’s parent or guardian.' }));
    expect(yes).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Luka’s birth date'), { target: { value: '2012-05-20' } });
    fireEvent.click(yes);
    await waitFor(() => expect(claimFamilyLink).toHaveBeenCalledWith(code, { as: 'PARENT', confirmed: true, childId: null, birthDate: '2012-05-20' }));
    expect(await screen.findByText('You’re Luka’s parent here now.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Parent Hub' })).toHaveAttribute('href', '/parent?player=31');
});

it('a teen’s link refuses an adult of the teen’s own football, and they can ask the club to confirm them', async () => {
    auth.isAuthenticated = true; auth.user = { fullName: 'Giorgi Beridze' };
    vi.mocked(previewFamilyLink).mockResolvedValue(teen);
    vi.mocked(claimFamilyLink).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { code: 'FAMILY_LINK_OWN_CLUB', message: 'refused' } } });
    vi.mocked(claimFamilyLink).mockResolvedValueOnce({ outcome: 'ASKED_CLUB', personId: 31, personName: 'Luka Kapanadze', mergeId: null });
    show();
    const yes = await screen.findByRole('button', { name: 'Yes' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'I’m Luka’s parent or guardian.' }));
    fireEvent.change(screen.getByLabelText('Luka’s birth date'), { target: { value: '2012-05-20' } });
    fireEvent.click(yes);
    expect(await screen.findByRole('alert')).toHaveTextContent('You play or work at Luka’s club, so this link can’t make you their parent on its own. If you are, ask the club to confirm you.');
    fireEvent.click(screen.getByRole('button', { name: 'Ask the club to confirm me' }));
    await waitFor(() => expect(claimFamilyLink).toHaveBeenLastCalledWith(code, { as: 'PARENT', confirmed: true, childId: null, birthDate: '2012-05-20', askClub: true }));
    expect(await screen.findByText('We asked the club to confirm you’re Luka’s parent. You’ll get a notice.')).toBeInTheDocument();
});

it('the club’s only leader has nobody to ask: the page says so, with no button to press', async () => {
    auth.isAuthenticated = true; auth.user = { fullName: 'Olga Owner' };
    vi.mocked(previewFamilyLink).mockResolvedValue(teen);
    vi.mocked(claimFamilyLink).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'FAMILY_LINK_ONLY_LEADER', message: 'refused' } } });
    show();
    const yes = await screen.findByRole('button', { name: 'Yes' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'I’m Luka’s parent or guardian.' }));
    fireEvent.change(screen.getByLabelText('Luka’s birth date'), { target: { value: '2012-05-20' } });
    fireEvent.click(yes);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nobody else at your club can confirm you. Add another Owner or Admin and they can, or ask GrassKickZ support.');
    expect(screen.queryByRole('button', { name: 'Ask the club to confirm me' })).not.toBeInTheDocument();
});

it('a club’s staff get the same door on its card', async () => {
    auth.isAuthenticated = true; auth.user = { fullName: 'Koba Coach' };
    vi.mocked(previewFamilyLink).mockResolvedValue(card);
    vi.mocked(claimFamilyLink).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'FAMILY_LINK_STAFF', message: 'refused' } } });
    show();
    expect(await screen.findByText('Dinamo Academy sent Nino’s card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Nino’s birth date'), { target: { value: '2016-04-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(await screen.findByRole('button', { name: 'Ask the club to confirm me' })).toBeInTheDocument();
});

it('a club’s card asks the exact birth date, and says so when it doesn’t match', async () => {
    auth.isAuthenticated = true; auth.user = { fullName: 'Tamar Kapanadze' };
    vi.mocked(previewFamilyLink).mockResolvedValue(card);
    vi.mocked(claimFamilyLink).mockRejectedValue({ response: { status: 409, data: { code: 'FAMILY_LINK_BIRTH_DATE' } } });
    show();
    expect(await screen.findByText('Dinamo Academy sent Nino’s card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nino’s birth date'), { target: { value: '2016-04-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(claimFamilyLink).toHaveBeenCalledWith(code, expect.objectContaining({ as: 'PARENT', birthDate: '2016-04-02' })));
    expect(await screen.findByText('That birth date doesn’t match the club’s card.')).toBeInTheDocument();
});

it('says plainly when the link was already used', async () => {
    vi.mocked(previewFamilyLink).mockResolvedValue({ ...teen, state: 'CLAIMED' });
    show();
    expect(await screen.findByText('This link has already been used.')).toBeInTheDocument();
});
