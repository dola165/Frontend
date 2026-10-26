import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../../api/axiosConfig';
import type { RoleProfile } from '../../../roles/domain';
import type { Profession } from '../../api';
import { RolesEditor } from '../RolesEditor';
import { ProfessionsEditor } from '../ProfessionsEditor';
import i18n from '../../../../i18n';

const account = vi.hoisted(() => ({ id: 17, sessionId: 'first-session' }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: account.id }, sessionId: account.sessionId, refreshNavigationCapabilities: () => Promise.resolve() }) }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));

const fan: RoleProfile = { role: 'FAN', primary: true, published: false };
const roles = () => <MemoryRouter><RolesEditor key={`${account.id}:${account.sessionId}`} /></MemoryRouter>;
const confirmed: Profession = { id: 4, title: 'Sports psychologist', label: 'Sports psychology', detail: null, since: '2015', published: true, verification: 'CLUB_CONFIRMED', verifiedBy: 'Dinamo Academy' };

const language = (value: string) => act(async () => { await i18n.changeLanguage(value); });

beforeEach(async () => {
    vi.resetAllMocks(); account.id = 17; account.sessionId = 'first-session';
    await i18n.changeLanguage('en');
    vi.mocked(apiClient.get).mockResolvedValue({ data: [fan] });
    vi.mocked(apiClient.put).mockImplementation(async (_url, body) => ({ data: (body as { profiles: RoleProfile[] }).profiles }));
});
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });

describe('football roles', () => {
    it('never offers club staff or organiser to someone who does not have them, and keeps them for someone who does', async () => {
        render(roles());
        await screen.findByRole('button', { name: 'Save roles' });
        expect(screen.getByRole('checkbox', { name: /Coach/ })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /academy staff/ })).toBeNull();
        expect(screen.queryByRole('checkbox', { name: /Tournament organizer/ })).toBeNull();
        cleanup();
        vi.mocked(apiClient.get).mockResolvedValue({ data: [{ role: 'CLUB_STAFF', primary: true, published: false }] });
        render(roles());
        await screen.findByRole('button', { name: 'Save roles' });
        fireEvent.click(screen.getByRole('checkbox', { name: /academy staff/ }));
        expect(screen.getByRole('checkbox', { name: /academy staff/ })).not.toBeChecked();
    });
    it('sends explicit false flags when an older server omits the hidden defaults', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [{ role: 'ORGANIZER', primary: true }] });
        render(roles());
        await screen.findByRole('button', { name: 'Save roles' });
        fireEvent.click(screen.getByRole('checkbox', { name: /Coach/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Save roles' }));
        await screen.findByText('Your football roles have been saved.');
        expect(apiClient.put).toHaveBeenCalledWith('/users/me/roles', { profiles: [
            { role: 'ORGANIZER', primary: true, published: false }, { role: 'COACH', primary: false, published: false },
        ] });
    });
    it('saves several roles with one main role and deliberate publication, without changing access', async () => {
        render(roles());
        await screen.findByRole('button', { name: 'Save roles' });
        fireEvent.click(screen.getByRole('checkbox', { name: /Coach/ }));
        const coach = within(screen.getByRole('region', { name: 'Coach details' }));
        expect(coach.getByRole('switch', { name: 'Show on my profile' })).not.toBeChecked();
        fireEvent.change(coach.getByRole('textbox', { name: 'Headline' }), { target: { value: 'Youth development coach' } });
        fireEvent.click(coach.getByRole('radio', { name: 'Main role' }));
        fireEvent.click(coach.getByRole('switch', { name: 'Show on my profile' }));
        const reads = vi.mocked(apiClient.get).mock.calls.length;
        await language('ka');
        expect(coach.getByRole('textbox', { name: 'მოკლე აღწერა' })).toHaveValue('Youth development coach');
        expect(coach.getByRole('radio', { name: 'მთავარი როლი' })).toBeChecked();
        expect(coach.getByRole('switch', { name: 'ჩემს პროფილზე გამოჩენა' })).toBeChecked();
        expect(apiClient.get).toHaveBeenCalledTimes(reads); expect(apiClient.put).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'როლების შენახვა' }));
        expect(await screen.findByText('თქვენი საფეხბურთო როლები შენახულია.')).toBeInTheDocument();
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
        await language('ka');
        expect(screen.getByRole('alert')).toHaveTextContent('თქვენი საფეხბურთო როლები ვერ ჩაიტვირთა.');
        expect(screen.queryByRole('button', { name: 'როლების შენახვა' })).not.toBeInTheDocument();
        expect(apiClient.get).toHaveBeenCalledTimes(1);
        vi.mocked(apiClient.get).mockResolvedValue({ data: [fan] });
        fireEvent.click(screen.getByRole('button', { name: 'ხელახლა ცდა' }));
        expect(await screen.findByRole('button', { name: 'როლების შენახვა' })).toBeEnabled();
        expect(apiClient.get).toHaveBeenCalledTimes(2); expect(apiClient.put).not.toHaveBeenCalled();
    });

    it('keeps unsaved details when the server rejects them', async () => {
        vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'An adult account is required.' } } });
        render(roles());
        await screen.findByRole('button', { name: 'Save roles' });
        fireEvent.change(screen.getByRole('textbox', { name: 'Headline' }), { target: { value: 'Profile' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save roles' }));
        await screen.findByRole('alert');
        expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Profile');
        expect(screen.queryByText('Your football roles have been saved.')).not.toBeInTheDocument();
        await language('ka');
        expect(screen.getByRole('textbox', { name: 'მოკლე აღწერა' })).toHaveValue('Profile');
        expect(screen.getByRole('alert')).toHaveTextContent('An adult account is required.');
        expect(apiClient.get).toHaveBeenCalledTimes(1); expect(apiClient.put).toHaveBeenCalledTimes(1);
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
        vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [confirmed], version: 0 } });
        vi.mocked(apiClient.put).mockImplementation(async (_url, body) => ({ data: { items: (body as { professions: Profession[] }).professions.map((item, index) => ({ ...confirmed, ...item, id: item.id ?? 50 + index, verification: item.id ? confirmed.verification : 'SELF_REPORTED' })), version: 1 } }));
        render(<MemoryRouter><ProfessionsEditor userId={17} /></MemoryRouter>);
        expect(await screen.findByText('Confirmed by Dinamo Academy')).toBeInTheDocument();
        await language('ka');
        expect(screen.getByText('დაადასტურა: Dinamo Academy')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'პროფესია' })).toHaveValue('Sports psychologist');
        expect(apiClient.get).toHaveBeenCalledTimes(1); expect(apiClient.put).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'ფიზიოთერაპევტი' }));
        expect(screen.getAllByRole('combobox', { name: 'პროფესია' }).map(field => (field as HTMLInputElement).value)).toEqual(['Sports psychologist', 'Physiotherapist']);
        fireEvent.click(screen.getByRole('button', { name: 'სამუშაოსა და უნარების შენახვა' }));
        expect(await screen.findByText('შენახულია.')).toBeInTheDocument();
        const sent = vi.mocked(apiClient.put).mock.calls[0][1] as { professions: Array<Record<string, unknown>> };
        expect(sent.professions.map(item => item.title)).toEqual(['Sports psychologist', 'Physiotherapist']);
        expect(sent).toMatchObject({ expectedVersion: 0, requestId: expect.any(String) });
        expect(sent.professions.every(item => !('verification' in item) && !('label' in item))).toBe(true);
        expect(screen.getByText('თავად მითითებული')).toBeInTheDocument();
    });
});
