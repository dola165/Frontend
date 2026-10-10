import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../../api/axiosConfig';
import type { RoleProfile } from '../../../roles/domain';
import type { Profession } from '../../api';
import { RolesEditor } from '../RolesEditor';
import { ProfessionsEditor } from '../ProfessionsEditor';

const account = vi.hoisted(() => ({ id: 17, sessionId: 'first-session' }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: account.id }, sessionId: account.sessionId, refreshNavigationCapabilities: () => Promise.resolve() }) }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));

const fan: RoleProfile = { role: 'FAN', primary: true, published: false };
const roles = () => <MemoryRouter><RolesEditor key={`${account.id}:${account.sessionId}`} /></MemoryRouter>;
const confirmed: Profession = { id: 4, title: 'Sports psychologist', label: 'Sports psychology', detail: null, since: '2015', published: true, verification: 'CLUB_CONFIRMED', verifiedBy: 'Dinamo Academy' };

beforeEach(() => {
    vi.resetAllMocks(); account.id = 17; account.sessionId = 'first-session';
    vi.mocked(apiClient.get).mockResolvedValue({ data: [fan] });
    vi.mocked(apiClient.put).mockImplementation(async (_url, body) => ({ data: (body as { profiles: RoleProfile[] }).profiles }));
});

describe('football roles', () => {
    it('saves several roles with one main role and deliberate publication, without changing access', async () => {
        render(roles());
        await screen.findByRole('button', { name: 'Save roles' });
        fireEvent.click(screen.getByRole('checkbox', { name: /Coach/ }));
        const coach = within(screen.getByRole('region', { name: 'Coach details' }));
        expect(coach.getByRole('switch', { name: 'Show on my profile' })).not.toBeChecked();
        fireEvent.change(coach.getByRole('textbox', { name: 'Headline' }), { target: { value: 'Youth development coach' } });
        fireEvent.click(coach.getByRole('radio', { name: 'Main role' }));
        fireEvent.click(coach.getByRole('switch', { name: 'Show on my profile' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save roles' }));
        expect(await screen.findByText('Your football roles have been saved.')).toBeInTheDocument();
        expect(apiClient.put).toHaveBeenCalledWith('/users/me/roles', { profiles: [
            { ...fan, primary: false }, { role: 'COACH', primary: true, published: true, headline: 'Youth development coach' },
        ] });
    });

    it('does not offer an empty editor that could overwrite roles after a load failure', async () => {
        vi.mocked(apiClient.get).mockRejectedValue(new Error('Offline'));
        render(roles());
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save roles' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('keeps unsaved details when the server rejects them', async () => {
        vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'An adult account is required.' } } });
        render(roles());
        await screen.findByRole('button', { name: 'Save roles' });
        fireEvent.change(screen.getByRole('textbox', { name: 'Headline' }), { target: { value: 'Keep my draft' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save roles' }));
        await screen.findByRole('alert');
        expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Keep my draft');
        expect(screen.queryByText('Your football roles have been saved.')).not.toBeInTheDocument();
    });

    it('discards a slower answer for the previous account', async () => {
        let finish: (value: { data: RoleProfile[] }) => void = () => undefined;
        vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const view = render(roles());
        account.id = 18; account.sessionId = 'second-session';
        vi.mocked(apiClient.get).mockResolvedValue({ data: [{ role: 'REFEREE', primary: true, published: false }] });
        view.rerender(roles());
        await screen.findByRole('region', { name: 'Referee details' });
        await act(async () => { finish({ data: [{ role: 'COACH', primary: true, published: false, headline: 'Other account' }] }); });
        expect(screen.queryByRole('region', { name: 'Coach details' })).not.toBeInTheDocument();
    });

    it('labels qualifications as self-reported', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [{ role: 'REFEREE', primary: true, published: true, qualifications: 'Local refereeing course' }] });
        render(roles());
        expect(await screen.findByText(/Shown as self-reported until a club or GrassKickZ confirms them/)).toBeInTheDocument();
    });
});

describe('work and skills', () => {
    it('adds a free-text profession from a suggestion and never sends verification', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [confirmed] });
        vi.mocked(apiClient.put).mockImplementation(async (_url, body) => ({ data: (body as { professions: Profession[] }).professions.map((item, index) => ({ ...confirmed, ...item, id: item.id ?? 50 + index, verification: item.id ? confirmed.verification : 'SELF_REPORTED' })) }));
        render(<MemoryRouter><ProfessionsEditor userId={17} /></MemoryRouter>);
        expect(await screen.findByText('Confirmed by Dinamo Academy')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Physiotherapist/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Save work and skills' }));
        expect(await screen.findByText('Saved.')).toBeInTheDocument();
        const sent = vi.mocked(apiClient.put).mock.calls[0][1] as { professions: Array<Record<string, unknown>> };
        expect(sent.professions.map(item => item.title)).toEqual(['Sports psychologist', 'Physiotherapist']);
        expect(sent.professions.every(item => !('verification' in item) && !('label' in item))).toBe(true);
        expect(screen.getByText('Self-reported')).toBeInTheDocument();
    });
});
