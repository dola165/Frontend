import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsDirectoryPage } from '../JobsDirectoryPage';
import { JobDetailPage } from '../JobDetailPage';
import * as api from '../../features/clubs/api';

const locale = vi.hoisted(() => ({ value: 'en' }));
const auth = vi.hoisted(() => ({ status: 'authenticated', user: { id: 55 } }));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: locale.value, resolvedLanguage: locale.value },
    }),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../features/clubs/api', () => ({
    fetchOpenJobDirectory: vi.fn(),
    fetchPublicJob: vi.fn(),
    fetchMyJobApplication: vi.fn(),
    createClubApplication: vi.fn(),
    cancelClubApplication: vi.fn(),
}));

const role: api.ClubJob = {
    id: 11,
    clubId: 7,
    title: 'Academy coach',
    description: 'Lead two weekly sessions and support match preparation.',
    requiredRole: 'COACH',
    category: 'COACHING',
    engagementType: 'PAID',
    status: 'OPEN',
    clubName: 'Tbilisi United',
    clubCityName: 'Tbilisi',
    clubCountryName: 'Georgia',
    createdAt: new Date().toISOString(),
};

function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}{location.search}</output>;
}

const renderDirectory = () => render(
    <MemoryRouter initialEntries={['/jobs']}>
        <LocationProbe />
        <JobsDirectoryPage />
    </MemoryRouter>,
);

const renderDetail = () => render(
    <MemoryRouter initialEntries={['/jobs/11']}>
        <Routes><Route path="/jobs/:id" element={<JobDetailPage />} /></Routes>
    </MemoryRouter>,
);

beforeEach(() => {
    vi.resetAllMocks();
    locale.value = 'en';
    auth.status = 'authenticated';
    auth.user = { id: 55 };
    vi.mocked(api.fetchOpenJobDirectory).mockResolvedValue([role]);
    vi.mocked(api.fetchPublicJob).mockResolvedValue(role);
    vi.mocked(api.fetchMyJobApplication).mockResolvedValue(null);
});

describe('football opportunities presentation', () => {
    it('puts the truthful referee pathway before coaching and club-role listings', async () => {
        renderDirectory();
        const referee = await screen.findByRole('heading', { name: 'Refereeing' });
        const coaching = screen.getByRole('heading', { name: 'Coaching' });
        expect(referee.compareDocumentPosition(coaching) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByText(/Appointments are invitation-based today/)).toBeVisible();
        expect(screen.getByText(/do not accept referee applications/)).toBeVisible();
        expect(screen.getByRole('link', { name: /Open referee workspace/ })).toHaveAttribute('href', '/referees/me');
        expect(screen.getByRole('link', { name: /How clubs find referees/ })).toHaveAttribute('href', '/match-exchange?tab=referees');
        expect(screen.queryByRole('button', { name: /Apply.*referee/i })).not.toBeInTheDocument();
    });

    it('routes coaching discovery through the supported category and keeps engagement meaning visible', async () => {
        renderDirectory();
        await screen.findByRole('link', { name: /Academy coach Tbilisi United/ });
        fireEvent.click(screen.getByRole('button', { name: 'Browse coaching roles' }));
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/jobs?category=COACHING'));
        const engagementGuide = within(screen.getByLabelText('Volunteer shifts availability'));
        expect(engagementGuide.getByText('Paid role')).toBeVisible();
        expect(engagementGuide.getByText('Ongoing volunteer role')).toBeVisible();
        expect(engagementGuide.getByText('Flexible')).toBeVisible();
        expect(screen.getByText('Event-shift signup is not available yet.')).toBeVisible();
    });

    it('opens a compact inline role preview instead of repeating the listing in a side rail', async () => {
        renderDirectory();
        fireEvent.click(await screen.findByRole('button', { name: 'Preview Academy coach' }));
        expect(screen.getByText('Send an application for club review')).toBeVisible();
        expect(screen.getByText(role.description!)).toBeVisible();
        expect(screen.queryByLabelText('Selected role')).not.toBeInTheDocument();
    });

    it('keeps application truth and lifecycle beside a bounded role detail', async () => {
        renderDetail();
        expect(await screen.findByRole('heading', { name: 'Academy coach' })).toBeVisible();
        expect(screen.getByRole('heading', { name: 'About this role' })).toBeVisible();
        expect(screen.getByRole('heading', { name: 'Apply for this role' })).toBeVisible();
        expect(screen.getByText(/does not confirm the role or grant club access/)).toBeVisible();
        expect(screen.getByLabelText('Application lifecycle')).toHaveTextContent('never granted automatically');
    });

    it('presents the new pathways in Georgian without changing the global locale registry', async () => {
        locale.value = 'ka';
        renderDirectory();
        expect(await screen.findByRole('heading', { name: 'მსაჯობა' })).toBeVisible();
        expect(screen.getByRole('heading', { name: 'მწვრთნელობა' })).toBeVisible();
        expect(screen.getByRole('link', { name: /მსაჯის სამუშაო სივრცის გახსნა/ })).toHaveAttribute('href', '/referees/me');
    });
});
