import '../../../i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JoinPage } from './JoinPage';
import { fetchJoinLink, type JoinLink } from '../api';

const auth = vi.hoisted(() => ({ sessionId: 'anon', isAuthenticated: false, isBootstrapping: false }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ fetchJoinLink: vi.fn(), sendJoin: vi.fn() }));
vi.mock('../../parents/api', () => ({ fetchJoiningChildren: vi.fn() }));

const code = 'k'.repeat(43);
const link: JoinLink = { code, page: { ref: { type: 'club', id: 10 }, name: 'Test FC', town: 'Tbilisi', crestUrl: null, profilePath: '/clubs/10', live: true }, squad: { id: 91, name: 'U12 mixed', ageGroup: 'U12', gender: 'MIXED' } };
const show = () => render(<MemoryRouter initialEntries={[`/join/${code}`]}><Routes><Route path="/join/:code" element={<JoinPage />} /></Routes></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); auth.isAuthenticated = false; auth.isBootstrapping = false; vi.mocked(fetchJoinLink).mockResolvedValue(link); });
afterEach(cleanup);

it('shows the club and squad to a visitor and sends them to sign in with the link as the way back', async () => {
    show();
    expect(await screen.findByRole('link', { name: 'Test FC' })).toHaveAttribute('href', '/clubs/10');
    expect(screen.getAllByText('U12 mixed · Tbilisi').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Sign in to ask to join' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/join/${code}`)}`);
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', `/signup?next=${encodeURIComponent(`/join/${code}`)}`);
    expect(screen.queryByRole('button', { name: /I am a parent/ })).not.toBeInTheDocument();
});

it('asks who is joining once the visitor is signed in', async () => {
    auth.isAuthenticated = true;
    show();
    expect(await screen.findByRole('button', { name: /I am a parent/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in to ask to join' })).not.toBeInTheDocument();
});

it('keeps the skeleton while the session is still being restored', async () => {
    auth.isBootstrapping = true;
    show();
    await screen.findByRole('status');
    expect(fetchJoinLink).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Sign in to ask to join' })).not.toBeInTheDocument();
});
