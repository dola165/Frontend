import '../../../i18n';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JoinPage } from './JoinPage';
import { fetchJoinLink, sendJoin, type JoinLink, type JoinSent } from '../api';
import { fetchJoiningChildren } from '../../parents/api';

const auth = vi.hoisted(() => ({ sessionId: 'anon', isAuthenticated: false, isBootstrapping: false, user: null as null | { fullName: string; dob: string | null } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ fetchJoinLink: vi.fn(), sendJoin: vi.fn() }));
vi.mock('../../parents/api', () => ({ fetchJoiningChildren: vi.fn() }));
/** Add child makes the card (Parent Hub's own form); here it makes Luka at once. */
vi.mock('../../parents/AddChild', () => ({ AddChild: ({ onCreated }: { onCreated: (id: number) => void }) => <button type="button" onClick={() => { kids.list = [luka]; onCreated(7); }}>Create the child’s card</button> }));

const code = 'k'.repeat(43);
const link: JoinLink = { code, page: { ref: { type: 'club', id: 10 }, name: 'Test FC', town: 'Tbilisi', crestUrl: null, profilePath: '/clubs/10', live: true }, squad: { id: 91, name: 'U12 mixed', ageGroup: 'U12', youthUnder: 12, gender: 'MIXED' } };
const sent: JoinSent = { id: 500, status: 'OPEN', squadId: 91, squadName: 'U12 mixed', clubName: 'Test FC', coachName: 'Giorgi Coach', childName: 'Luka', destination: '/admissions/inquiries/500', nextTraining: { title: 'Training', startsAt: '2026-10-27T13:00:00Z', endsAt: '2026-10-27T14:30:00Z' } };
const luka = { playerId: 7, identity: { fullName: 'Luka Beridze', dateOfBirth: '2015-05-01' }, clubs: [] };
const kids = vi.hoisted(() => ({ list: [] as unknown[] }));
const show = (entry = `/join/${code}`) => render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/join/:code" element={<JoinPage />} /></Routes></MemoryRouter>);
const signIn = (dob: string | null) => { auth.isAuthenticated = true; auth.user = { fullName: 'Nino Beridze', dob }; };
const problem = (code: string, message: string) => ({ response: { status: 409, data: { code, message } } });
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); auth.isAuthenticated = false; auth.isBootstrapping = false; auth.user = null; vi.mocked(fetchJoinLink).mockResolvedValue(link);
    kids.list = []; vi.mocked(fetchJoiningChildren).mockImplementation(async () => ({ children: kids.list }) as never); });
afterEach(cleanup);

it('asks who is joining before sign-in, then signs in and comes straight back to the same choice', async () => {
    show();
    expect(await screen.findByRole('link', { name: 'Test FC' })).toHaveAttribute('href', '/clubs/10');
    fireEvent.click(screen.getByRole('button', { name: /My child/ }));
    const back = `/join/${code}?who=child`;
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(back)}`);
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', `/signup?next=${encodeURIComponent(back)}`);
});

it('my child: the only child is chosen at once, then "Sent to coach Giorgi" with the next training', async () => {
    signIn('1985-04-02');
    kids.list = [luka];
    vi.mocked(sendJoin).mockResolvedValue(sent);
    show(`/join/${code}?who=child`);
    expect(within(await screen.findByRole('group', { name: 'Your children' })).getByRole('button', { name: /Luka/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Send for Luka' }));
    await waitFor(() => expect(sendJoin).toHaveBeenCalledWith(code, { who: 'PARENT', childName: 'Luka Beridze', birthDate: '2015-05-01', consent: true, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) }));
    expect(await screen.findByText('Sent to coach Giorgi')).toBeInTheDocument();
    expect(screen.getByText('Next training')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Follow your request' })).toHaveAttribute('href', '/admissions/inquiries/500');
});

it('a parent with no child yet makes the card first, and the new child is chosen', async () => {
    signIn('1985-04-02');
    vi.mocked(sendJoin).mockResolvedValue(sent);
    show(`/join/${code}?who=child`);
    fireEvent.click(await screen.findByRole('button', { name: 'Create the child’s card' }));
    expect(within(await screen.findByRole('group', { name: 'Your children' })).getByRole('button', { name: /Luka/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Send for Luka' }));
    await waitFor(() => expect(sendJoin).toHaveBeenCalledWith(code, expect.objectContaining({ who: 'PARENT', childName: 'Luka Beridze', birthDate: '2015-05-01' })));
});

it('offers a child another parent already added, and never links them silently', async () => {
    signIn('1985-04-02');
    kids.list = [luka];
    vi.mocked(sendJoin).mockRejectedValueOnce(problem('CHILD_ALREADY_LISTED', 'Is this Luka, added by another parent?'))
        .mockResolvedValue({ squadId: 91, squadName: 'U12 mixed', clubName: 'Test FC', coachName: null, nextTraining: null, status: 'PARENT_LINK_REQUESTED', childName: 'Luka' });
    show(`/join/${code}?who=child`);
    within(await screen.findByRole('group', { name: 'Your children' })).getByRole('button', { name: /Luka/ });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Send for Luka' }));
    expect(await screen.findByText('Is this Luka, added by another parent?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, that’s my child' }));
    await waitFor(() => expect(sendJoin).toHaveBeenLastCalledWith(code, expect.objectContaining({ who: 'PARENT', sameChild: true })));
    expect(await screen.findByText('Luka is already on the list')).toBeInTheDocument();
    expect(screen.getByText('We asked the parent who added Luka to confirm you. You will get a notice.')).toBeInTheDocument();
});

it('asks a grown-up choosing Me for a youth squad whether they are joining for their child', async () => {
    signIn('1985-04-02');
    show(`/join/${code}?who=me`);
    expect(await screen.findByText('Joining for your child?')).toBeInTheDocument();
    expect(screen.getByText('U12 mixed is for players under 12.')).toBeInTheDocument();
    expect(sendJoin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, my child' }));
    expect(await screen.findByRole('button', { name: 'Create the child’s card' })).toBeInTheDocument();
});

it('a teen choosing Me sends their own request without retyping anything', async () => {
    signIn(`${new Date().getFullYear() - 15}-01-01`);
    vi.mocked(fetchJoinLink).mockResolvedValue({ ...link, squad: { ...link.squad, name: 'U16', ageGroup: 'U16', youthUnder: 16 } });
    vi.mocked(sendJoin).mockResolvedValue({ ...sent, coachName: null, squadName: 'U16' });
    show(`/join/${code}?who=me`);
    expect(await screen.findByText('Under 18: a parent or guardian confirms the joining terms.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send my request' }));
    await waitFor(() => expect(sendJoin).toHaveBeenCalledWith(code, { who: 'PLAYER', consent: true, requestId: expect.any(String) }));
    expect(await screen.findByText('Sent to Test FC')).toBeInTheDocument();
});

it('keeps the skeleton while the session is still being restored', async () => {
    auth.isBootstrapping = true;
    show();
    await screen.findByRole('status');
    expect(fetchJoinLink).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /My child/ })).not.toBeInTheDocument();
});

it('an account under 18 joins only as itself: no "My child", and a child link explains why', async () => {
    signIn('2010-06-01');
    show();
    expect(await screen.findByRole('button', { name: /Me/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /My child/ })).not.toBeInTheDocument();
    cleanup();
    show(`/join/${code}?who=child`);
    expect(await screen.findByText(/Only a parent or guardian who is 18 or older can add a child/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create the child’s card' })).not.toBeInTheDocument();
});
