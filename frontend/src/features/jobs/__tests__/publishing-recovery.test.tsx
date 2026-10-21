import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostJobPage } from '../../../pages/PostJobPage';
import { fetchMyClubMembershipContext } from '../../clubs/api';
import { postJob } from '../api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 1 } }) }));
vi.mock('../../clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), postJob: vi.fn() }));
vi.mock('../../world/useWorldArea', () => ({ useWorldArea: () => ({ area: { city: 'Tbilisi', anywhere: false } }) }));

const draft = { posterKind: 'CLUB', clubId: 10, clubName: 'Alpha FC', direction: 'HIRING', category: 'COACHING', terms: 'PAID', hours: '', title: 'Coach for the girls team', description: 'Two evenings every week.', pay: '', city: 'Tbilisi', licence: '', applyMethod: 'IN_APP', applyTarget: '' };
const membership = { hasClubMembership: true, canCreateClub: false, clubId: 10, clubName: 'Alpha FC', myRole: 'COACH' } as const;
const open = (url = '/jobs/new?step=3') => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/jobs/new" element={<PostJobPage />} /><Route path="/jobs/:id" element={<h1>Published job</h1>} /></Routes></MemoryRouter>);

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('userId', '1');
    sessionStorage.setItem('gk.job.draft:1', JSON.stringify(draft));
    vi.mocked(postJob).mockResolvedValue({ id: 900, title: draft.title } as never);
});

describe('An explicit job publisher', () => {
    it('keeps a club actor on membership failure and retries the check before publishing', async () => {
        vi.mocked(fetchMyClubMembershipContext).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(membership);
        open();
        expect(await screen.findByRole('alert')).toHaveTextContent('Posting as Alpha FC');
        expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
        expect(postJob).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Retry club check' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await screen.findByRole('heading', { name: 'Published job' });
        expect(postJob).toHaveBeenCalledWith(expect.objectContaining({ posterKind: 'CLUB', clubId: 10, title: draft.title, applyMethod: 'IN_APP' }));
    });

    it('requires an explicit choice to publish personally after club permission is removed', async () => {
        vi.mocked(fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: false, canCreateClub: true, clubId: null });
        open();
        expect(await screen.findByRole('alert')).toHaveTextContent('Posting as Alpha FC');
        expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
        expect(postJob).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Post as myself instead' }));
        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await screen.findByRole('heading', { name: 'Published job' });
        expect(postJob).toHaveBeenCalledWith(expect.objectContaining({ posterKind: 'PERSON', clubId: null, title: draft.title, applyMethod: 'MESSAGE' }));
    });

    it('does not retarget an existing club draft when a different club is in the address', async () => {
        vi.mocked(fetchMyClubMembershipContext).mockResolvedValue({ ...membership, clubId: 20, clubName: 'Beta FC' });
        open('/jobs/new?club=20&step=3');
        expect(await screen.findByRole('alert')).toHaveTextContent('Posting as Alpha FC');
        expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
        expect(JSON.parse(sessionStorage.getItem('gk.job.draft:1')!)).toMatchObject({ clubId: 10, title: draft.title });
        expect(postJob).not.toHaveBeenCalled();
    });
});
