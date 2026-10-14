vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 1 } }) }));
import type { ImgHTMLAttributes } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsPage } from '../../../pages/JobsPage';
import { JobsCataloguePage } from '../../../pages/JobsCataloguePage';
import { JobDetailPage } from '../../../pages/JobDetailPage';
import { PostJobPage } from '../../../pages/PostJobPage';
import { activeFilters, jobsHeading, jobsPath, readJobs, worldJobsPath } from '../query';
import * as api from '../api';
import * as clubsApi from '../../clubs/api';
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchJobs: vi.fn(), fetchJobsFront: vi.fn(), fetchJob: vi.fn(), postJob: vi.fn() }));
vi.mock('../../clubs/api', async original => ({ ...await original<typeof import('../../clubs/api')>(), fetchPublicJob: vi.fn(), fetchMyJobApplication: vi.fn(), fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(async () => ({ data: { id: 10, name: 'Alpha FC' } })) } }));
vi.mock('../../../components/ui/MediaImage', () => ({ MediaImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));
const clubJob: api.Job = { id: 401, clubId: 10, clubName: 'Alpha FC', clubCityName: 'Tbilisi', clubCountryName: 'Georgia', title: 'U12 assistant coach', description: 'Three evenings a week.', category: 'COACHING', engagementType: 'PAID', requiredRole: 'COACH', status: 'OPEN', createdAt: '2026-10-10T10:00:00Z', applicationCount: 3, direction: 'HIRING', poster: { kind: 'CLUB', id: 10, name: 'Alpha FC', avatarUrl: null, city: 'Tbilisi' }, pay: 'GEL 700 / month', hours: 'PART_TIME', licence: 'UEFA C', applyMethod: 'IN_APP', distanceKm: 4 };
const personJob: api.Job = { id: 701, clubId: null, clubCityName: 'Tbilisi', title: 'Personal trainer for a 12-year-old', description: 'Vake, after school.', category: 'COACHING', engagementType: 'PAID', status: 'OPEN', createdAt: '2026-10-12T10:00:00Z', direction: 'HIRING', poster: { kind: 'PERSON', id: 5038, name: 'Nino Lomidze', avatarUrl: null, city: 'Tbilisi' }, pay: 'GEL 40 / session', hours: 'SESSIONS', applyMethod: 'MESSAGE' };
const offering: api.Job = { ...personJob, id: 704, title: 'UEFA B coach available for private sessions', direction: 'OFFERING', poster: { kind: 'PERSON', id: 5001, name: 'Giorgi Beridze', avatarUrl: null, city: 'Tbilisi' }, pay: 'GEL 60 / session' };
beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    vi.mocked(api.fetchJobs).mockResolvedValue({ content: [clubJob, personJob], totalElements: 2 });
    vi.mocked(api.fetchJobsFront).mockResolvedValue({ city: 'Tbilisi', role: 'COACH', pins: [{ kind: 'club', clubId: 10, label: 'Alpha FC', crest: null, lat: 41.7, lng: 44.8, count: 1 }], forYou: [clubJob, personJob], near: [personJob], offering: [offering], followed: [clubJob], fresh: [personJob], applications: [{ ...clubJob, application: { id: 1, status: 'PENDING' } }], postings: [], open: 2, available: 1 });
    vi.mocked(clubsApi.fetchPublicJob).mockImplementation(async id => (id === 701 ? personJob : id === 704 ? offering : clubJob) as never);
    vi.mocked(clubsApi.fetchMyJobApplication).mockResolvedValue(null);
    vi.mocked(clubsApi.fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: true, canCreateClub: false, clubId: 10, clubName: 'Alpha FC', myRole: 'COACH' });
});

describe('The search in the address', () => {
    it('reads, writes, names a search and carries it to the map', () => {
        const query = readJobs(new URLSearchParams('direction=OFFERING&category=COACHING&terms=PAID&city=Tbilisi&sort=NEAREST&job=704'));
        expect(query).toMatchObject({ direction: 'OFFERING', category: 'COACHING', terms: 'PAID', city: 'Tbilisi', sort: 'NEAREST', job: 704 });
        expect(jobsPath(query)).toBe('/jobs/all?direction=OFFERING&category=COACHING&terms=PAID&city=Tbilisi&sort=NEAREST&job=704');
        expect(jobsHeading(query)).toEqual({ title: 'Coaching: people available', hint: 'Coaches, referees and specialists offering their time' });
        expect(activeFilters(query, false).map(f => f.label)).toEqual(['People available', 'Coaching', 'Paid', 'Tbilisi']);
        expect(worldJobsPath(query)).toBe('/world/opportunities?tab=jobs&category=COACHING&engagement=PAID&city=Tbilisi');
        expect(readJobs(new URLSearchParams('direction=NOPE&hours=NOPE'))).toMatchObject({ direction: '', hours: '', sort: 'RELEVANCE' });
    });
});

describe('Front, catalogue and the listing', () => {
    it('shows the map, my application, both sides and real examples', async () => {
        render(<MemoryRouter initialEntries={['/jobs']}><Routes><Route path="/jobs" element={<JobsPage />} /></Routes></MemoryRouter>);
        expect(await screen.findByText('Applied · waiting for an answer')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Jobs on the map' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '2 open jobs and volunteer roles' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Browse people available' })).toHaveAttribute('href', '/jobs/all?direction=OFFERING');
        expect(screen.getAllByRole('link', { name: 'Post a job' })[0]).toHaveAttribute('href', '/jobs/new?as=hire');
        expect(screen.getAllByRole('link').find(link => link.getAttribute('href') === '/jobs/704')).toHaveTextContent('UEFA B coach available');
        expect(api.fetchJobsFront).toHaveBeenCalledWith('Tbilisi', expect.any(AbortSignal));
    });
    it('opens the chosen listing beside the list and keeps the search in the request', async () => {
        render(<MemoryRouter initialEntries={['/jobs/all?category=COACHING&poster=people']}><Routes><Route path="/jobs/all" element={<JobsCataloguePage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('heading', { name: 'Coaching' })).toBeInTheDocument();
        expect(api.fetchJobs).toHaveBeenCalledWith(expect.objectContaining({ category: 'COACHING', poster: 'people', direction: 'ALL', page: 0, size: 24, sort: 'RELEVANCE' }), expect.any(AbortSignal));
        expect(await screen.findByRole('heading', { level: 2, name: 'U12 assistant coach' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Personal trainer for a 12-year-old/ }));
        expect(await screen.findByRole('heading', { level: 2, name: 'Personal trainer for a 12-year-old' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Message Nino to apply' })).toHaveAttribute('href', '/messages?chatWith=5038');
        expect(api.fetchJobs).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('link', { name: 'Show on map' })).toHaveAttribute('href', '/world/opportunities?tab=jobs&category=COACHING');
    });
    it('shows a person who is available with a way to message them', async () => {
        render(<MemoryRouter initialEntries={['/jobs/704']}><Routes><Route path="/jobs/:id" element={<JobDetailPage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('heading', { level: 1, name: offering.title })).toBeInTheDocument();
        expect(screen.getByText('Available')).toBeInTheDocument();
        expect(screen.getByText('GEL 60 / session')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Message Giorgi' })).toHaveAttribute('href', '/messages?chatWith=5001');
    });
});

describe('Posting', () => {
    it('publishes a listing by a person in three screens', async () => {
        vi.mocked(api.postJob).mockResolvedValue({ ...personJob, id: 900, title: 'Goalkeeper coach for my daughter' });
        render(<MemoryRouter initialEntries={['/jobs/new']}><Routes><Route path="/jobs/new" element={<PostJobPage />} /><Route path="/jobs/:id" element={<h1>Published page</h1>} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'As myself' }));
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /^Coaching/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Goalkeeper coach for my daughter' } });
        fireEvent.change(screen.getByLabelText('About the role'), { target: { value: 'Weekends in Saburtalo, U14 keeper.' } });
        fireEvent.change(screen.getByLabelText('Pay'), { target: { value: 'GEL 50 / session' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: /^Email/ }));
        expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'nino@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await screen.findByRole('heading', { name: 'Published page' });
        expect(api.postJob).toHaveBeenCalledWith(expect.objectContaining({ posterKind: 'PERSON', direction: 'HIRING', category: 'COACHING', title: 'Goalkeeper coach for my daughter', pay: 'GEL 50 / session', applyMethod: 'EMAIL', applyTarget: 'nino@example.com' }));
    });
    it('lists a person as available', async () => {
        vi.mocked(api.postJob).mockResolvedValue({ ...offering, id: 901 });
        render(<MemoryRouter initialEntries={['/jobs/new']}><Routes><Route path="/jobs/new" element={<PostJobPage />} /><Route path="/jobs/:id" element={<h1>Listed page</h1>} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: /I’m available/ }));
        fireEvent.click(screen.getByRole('button', { name: /Matchday & referees/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Referee available at weekends' } });
        fireEvent.change(screen.getByLabelText('About you'), { target: { value: 'GFF regional referee, Tbilisi.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'List myself' }));
        await waitFor(() => expect(api.postJob).toHaveBeenCalledWith(expect.objectContaining({ direction: 'OFFERING', category: 'MATCHDAY', applyMethod: 'MESSAGE' })));
    });
});
