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
    fireEvent.click(yes);
    await waitFor(() => expect(claimFamilyLink).toHaveBeenCalledWith(code, { as: 'PARENT', confirmed: true, childId: null, birthDate: null }));
    expect(await screen.findByText('You’re Luka’s parent here now.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Parent Hub' })).toHaveAttribute('href', '/parent?player=31');
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
