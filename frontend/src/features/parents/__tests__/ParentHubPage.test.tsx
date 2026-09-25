import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentHubPage } from '../../../pages/ParentHubPage';
import { activateChild, fetchParentHub, type ParentHub } from '../api';

const auth = vi.hoisted(() => ({ user: { id: 7 }, sessionId: 'parent-session', isAuthenticated: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ fetchParentHub: vi.fn(), activateChild: vi.fn() }));
vi.mock('../../squadCommunication/api', () => ({ spaces: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../utils/authStorage', () => ({ isCurrentAuthSession: (sessionId: string) => sessionId === auth.sessionId }));
vi.mock('../../../components/ui/MediaImage', () => ({ MediaImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));

const fixture = (): ParentHub => ({
    scheduleFrom: '2026-09-13T10:00:00', scheduleTo: '2026-10-13T10:00:00', children: [
        { cardId: 501, userId: 61, fullName: 'Nika Player', birthYear: new Date().getFullYear() - 14,
            photoUrl: null, position: 'GOALKEEPER', registered: false, activationEligible: true,
            clubId: 1, clubName: 'Creekside FC', squadNames: ['U15'], affiliationStatus: 'ACTIVE',
            consentStatus: 'CONFIRMED', trialEndsOn: null, publicEvents: [{ eventId: 70, occurrenceId: '70:one',
                title: 'Club open training', eventType: 'TRAINING', startsAt: '2026-09-14T17:00:00',
                endsAt: '2026-09-14T18:00:00', locationName: 'Academy pitch', status: 'SCHEDULED' }] },
        { cardId: 502, userId: 62, fullName: 'Saba Player', birthYear: 2014, photoUrl: null, position: null,
            registered: false, activationEligible: false, clubId: 2, clubName: 'Metro Academy', squadNames: [],
            affiliationStatus: 'TRIALIST', consentStatus: 'PENDING', trialEndsOn: '2026-09-30', publicEvents: [] },
    ],
});

const renderHub = () => render(<MemoryRouter><ParentHubPage /></MemoryRouter>);

describe('Parent Hub', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.user = { id: 7 }; auth.sessionId = 'parent-session'; auth.isAuthenticated = true;
        vi.mocked(fetchParentHub).mockResolvedValue(fixture());
    });

    it('switches club connections without showing another child’s events or activation', async () => {
        renderHub();
        await screen.findByRole('button', { name: /Nika Player Creekside FC/ });
        expect(screen.getByRole('region', { name: 'Nika Player’s schedule' })).toBeInTheDocument();
        expect(screen.getAllByText(/Creekside FC/).length).toBeGreaterThan(0);
        expect(screen.getAllByText('Consent confirmed').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /Nika Player Creekside FC/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('link', { name: /Enrollment requests/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Club open training')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText(/Account & consent/));
        expect(screen.getByRole('button', { name: 'Activate child account' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Saba Player Metro Academy/ }));
        expect(screen.getByRole('region', { name: 'Saba Player’s schedule' })).toBeInTheDocument();
        expect(screen.getAllByText('Consent waiting').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /Saba Player Metro Academy/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByText('Club open training')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Activate child account' })).not.toBeInTheDocument();
        expect(screen.getByText(/Open the latest consent email/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View club' })).toHaveAttribute('href', '/clubs/2');
    });

    it('distinguishes an empty family from a failed request and offers retry', async () => {
        vi.mocked(fetchParentHub).mockRejectedValueOnce(new Error('Failed')).mockResolvedValueOnce({ ...fixture(), children: [] });
        renderHub();
        await screen.findByRole('alert');
        expect(screen.queryByText("Your children's clubs belong here")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await screen.findByText("Your children's clubs belong here");
        expect(screen.getByRole('link', { name: /Check my account/ })).toHaveAttribute('href', '/account?tab=security');
    });

    it('ignores an old account response after switching sessions', async () => {
        let finishFirst!: (value: ParentHub) => void;
        vi.mocked(fetchParentHub).mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve; }))
            .mockResolvedValueOnce({ ...fixture(), children: [] });
        const { rerender } = renderHub();
        auth.user = { id: 8 }; auth.sessionId = 'other-session';
        rerender(<MemoryRouter><ParentHubPage /></MemoryRouter>);
        await screen.findByText("Your children's clubs belong here");
        await act(async () => { finishFirst(fixture()); });
        expect(screen.queryByText('Nika Player')).not.toBeInTheDocument();
        expect(screen.queryByText('Club open training')).not.toBeInTheDocument();
    });

    it('activates with the selected card and keeps one-time credentials until acknowledged', async () => {
        vi.mocked(activateChild).mockResolvedValue({ username: 'nika-child', tempPassword: 'one-time-demo-secret' });
        renderHub();
        fireEvent.click(await screen.findByText(/Account & consent/));
        fireEvent.click(screen.getByRole('button', { name: 'Activate child account' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Date of birth'), { target: { value: `${new Date().getFullYear() - 14}-01-01` } });
        fireEvent.change(within(dialog).getByLabelText("Child's email"), { target: { value: 'nika@example.com' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Activate account' }));
        await screen.findByText('Their account is ready');
        expect(activateChild).toHaveBeenCalledWith(501, `${new Date().getFullYear() - 14}-01-01`, 'nika@example.com', 'parent-session');
        expect(screen.getByLabelText('Temporary password')).toHaveValue('one-time-demo-secret');
        const unsavedExit = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(unsavedExit);
        expect(unsavedExit.defaultPrevented).toBe(true);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'I have saved the sign-in details' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        const savedExit = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(savedExit);
        expect(savedExit.defaultPrevented).toBe(false);
    });

    it('discards activation credentials when the account changes during the request', async () => {
        let finishActivation!: (value: { username: string; tempPassword: string }) => void;
        vi.mocked(activateChild).mockReturnValue(new Promise(resolve => { finishActivation = resolve; }));
        const { rerender } = renderHub();
        fireEvent.click(await screen.findByText(/Account & consent/));
        fireEvent.click(screen.getByRole('button', { name: 'Activate child account' }));
        fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: `${new Date().getFullYear() - 14}-01-01` } });
        fireEvent.change(screen.getByLabelText("Child's email"), { target: { value: 'nika@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
        const pendingExit = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(pendingExit);
        expect(pendingExit.defaultPrevented).toBe(true);
        auth.user = { id: 8 }; auth.sessionId = 'other-session';
        vi.mocked(fetchParentHub).mockResolvedValueOnce({ ...fixture(), children: [] });
        rerender(<MemoryRouter><ParentHubPage /></MemoryRouter>);
        await act(async () => { finishActivation({ username: 'private-child', tempPassword: 'private-secret' }); });
        await screen.findByText("Your children's clubs belong here");
        expect(screen.queryByDisplayValue('private-secret')).not.toBeInTheDocument();
        const nextAccountExit = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(nextAccountExit);
        expect(nextAccountExit.defaultPrevented).toBe(false);
    });
});
