import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppealForm } from './AppealForm';
import { CampaignHistory } from './CampaignHistory';
import { PersonalFundraising } from './PersonalFundraising';
import { FundraiserCard, Progress } from './FundraiserCard';
import { fetchPersonalCampaign, movePersonalCampaign, progressOf, safeGivingUrl, savePersonalCampaign, type Campaign } from './api';

const auth = vi.hoisted(() => ({ sessionId: 'A', isAuthenticated: true, user: { id: 10 } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../utils/authStorage', async original => ({ ...await original<typeof import('../../utils/authStorage')>(), assertCurrentAuthSession: vi.fn(), isCurrentAuthSession: () => true, getStoredUserId: () => String(auth.user.id) }));
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), savePersonalCampaign: vi.fn(), fetchPersonalCampaign: vi.fn(), movePersonalCampaign: vi.fn() }));

export const personal = (patch: Partial<Campaign> = {}): Campaign => ({
    id: 7, clubId: null, clubName: '', title: 'Boots for my season', summary: 'Adult kit support', description: 'Replace worn boots',
    beneficiary: 'Adult footballer', useOfFunds: 'Boots', category: 'EQUIPMENT', currency: 'GEL', goalAmount: 200, reportedAmount: null,
    reportedNote: '', reportedAt: null, startsOn: null, endsOn: null, images: [], status: 'PUBLISHED', phase: 'ACTIVE', version: 2,
    updatedAt: '2026-10-30T10:00:00Z', publishedAt: '2026-10-30T10:00:00Z', updates: [],
    publisher: { kind: 'PERSON', name: 'Adult footballer', userId: 10, profilePath: '/profile/10' }, ...patch,
});

beforeEach(() => { sessionStorage.clear(); auth.user.id = 10; vi.clearAllMocks(); });

describe('giving and truthful public progress', () => {
    it.each(['javascript:alert(1)', 'https://gofundme.com.evil.test/f/a', 'https://user@gofundme.com/f/a', 'https://gofundme.com:444/f/a', 'https://gofundme.com\\@evil.test/f/a', 'https://gofundme.com/f/a\n', 'http://gofundme.com/f/a'])('does not offer unsafe outside destination %s', value => expect(safeGivingUrl(value)).toBeNull());
    it('keeps a genuine external URL without claiming that it can receive funds', () => expect(safeGivingUrl('https://www.gofundme.com/f/adult-kit?utm_source=share')).toBe('https://www.gofundme.com/f/adult-kit?utm_source=share'));
    it('keeps missing distinct from a reported zero and invents no donation count', () => {
        expect(progressOf(personal()).raised).toBeNull();
        expect(progressOf(personal({ reportedAmount: 0 }))).toMatchObject({ raised: 0, percent: 0, donations: null });
        render(<Progress campaign={personal()} />);
        expect(screen.getByText('Not reported yet')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    it('renders a personal organizer without a club badge or invented club link', () => {
        render(<MemoryRouter><FundraiserCard campaign={personal()} /></MemoryRouter>);
        expect(screen.getByText('Personal appeal')).toBeInTheDocument();
        expect(screen.getByText('Adult footballer')).toBeInTheDocument();
        expect(document.querySelector('a[href*="clubs/"]')).toBeNull();
        expect(document.querySelector('img')).toBeNull();
    });
    it('retains each historical currency and missing/zero report', () => {
        render(<CampaignHistory campaign={personal({ history: [
            { version: 1, status: 'PUBLISHED', currency: 'GEL', goalAmount: 200, reportedAmount: 0, reportedNote: 'Counted today', reportedAt: '2026-10-29T10:00:00Z', recordedAt: '2026-10-29T10:00:00Z', attribution: 'Reported by Adult footballer' },
            { version: 2, status: 'PAUSED', currency: 'EUR', goalAmount: 100, reportedAmount: null, reportedNote: '', reportedAt: null, recordedAt: '2026-10-30T10:00:00Z', attribution: 'Reported by Adult footballer' },
        ] })} />);
        expect(screen.getByText(/No amount reported · target €100/)).toBeInTheDocument();
        expect(screen.getByText(/reported · target.*200/)).toBeInTheDocument();
        expect(screen.getByText('Counted today')).toBeInTheDocument();
    });
});

describe('owned draft and uncertain-save recovery', () => {
    it('clears an acknowledged publication request before reloading or remounting', async () => {
        vi.mocked(fetchPersonalCampaign).mockResolvedValue(personal({ status: 'DRAFT', phase: 'DRAFT', publishedAt: null }));
        vi.mocked(movePersonalCampaign).mockImplementation(async () => {
            vi.mocked(fetchPersonalCampaign).mockResolvedValue(personal());
            return personal();
        });
        const first = render(<MemoryRouter initialEntries={['/campaigns?mine=7']}><PersonalFundraising /></MemoryRouter>);
        await screen.findByLabelText('Title');
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await screen.findByRole('button', { name: 'Pause' });
        first.unmount();
        render(<MemoryRouter initialEntries={['/campaigns?mine=7']}><PersonalFundraising /></MemoryRouter>);
        expect(await screen.findByLabelText('Title')).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Retry the same change' })).not.toBeInTheDocument();
    });
    it('retries the same payload and id after a lost acknowledgement', async () => {
        vi.mocked(savePersonalCampaign).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce(personal());
        const saved = vi.fn();
        render(<MemoryRouter><AppealForm onSaved={saved} /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My boots' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
        await screen.findByRole('button', { name: 'Retry the same save' });
        expect(screen.getByLabelText('Title')).toBeDisabled();
        const first = vi.mocked(savePersonalCampaign).mock.calls[0];
        fireEvent.click(screen.getByRole('button', { name: 'Retry the same save' }));
        await waitFor(() => expect(saved).toHaveBeenCalled());
        expect(vi.mocked(savePersonalCampaign).mock.calls[1]).toEqual(first);
    });
    it('keeps one account draft out of a different account on the same tab', () => {
        const first = render(<MemoryRouter><AppealForm /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Private draft A' } });
        first.unmount(); auth.user.id = 20;
        render(<MemoryRouter><AppealForm /></MemoryRouter>);
        expect(screen.getByLabelText('Title')).toHaveValue('');
    });
    it('clears the working amounts when selecting a different currency', () => {
        render(<MemoryRouter><AppealForm campaign={personal({ reportedAmount: 50 })} /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
        expect(screen.getByLabelText('Target (optional)')).toHaveValue(null);
        expect(screen.getByLabelText('Reported total (optional)')).toHaveValue(null);
        expect(screen.getByText(/Earlier reports keep their currency/)).toBeInTheDocument();
    });
});
