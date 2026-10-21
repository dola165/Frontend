import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../../i18n';
import { RefereeRequest } from '../detail/RefereeRequest';
import { useAction, useLoad } from '../hooks';
import { post, type Match } from '../api';

vi.mock('../hooks', () => ({ useLoad: vi.fn(), useAction: vi.fn() }));
vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), post: vi.fn() }));

it('keeps an unknown or failed referee request separate from no request, then retries and appoints with the same revision in Georgian', async () => {
    const reload = vi.fn(), refresh = vi.fn();
    const match = { event_id: 12, revision: 7, appointments: [] } as unknown as Match;
    const view = () => <MemoryRouter><RefereeRequest match={match} reload={reload} /></MemoryRouter>;
    vi.mocked(useAction).mockReturnValue({ busy: false, feedback: <></>, run: async action => { await action(); } });
    vi.mocked(useLoad).mockReturnValue({ data: undefined, error: '', reload: refresh });
    await i18n.changeLanguage('ka');
    try {
        const { rerender } = render(view());
        expect(screen.getByRole('status', { name: 'მსაჯის მოთხოვნა იტვირთება' })).toBeInTheDocument();
        expect(screen.queryByText('მსაჯის ღია მოთხოვნის გამოქვეყნება')).not.toBeInTheDocument();
        vi.mocked(useLoad).mockReturnValue({ data: undefined, error: 'Could not load this page.', reload: refresh });
        rerender(view());
        expect(screen.getByText('მსაჯის მოთხოვნა ვერ ჩაიტვირთა')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'მოთხოვნის გამოქვეყნება' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'ხელახლა ცდა' }));
        expect(refresh).toHaveBeenCalledOnce();
        vi.mocked(useLoad).mockReturnValue({ data: { status: 'OPEN', volunteer: true, fee: 0, currency: 'GEL', applications: [{ referee_id: 23, full_name: 'Nika Official', status: 'PENDING' }] }, error: '', reload: refresh });
        rerender(view());
        expect(screen.getByText('განსახილველია 1 შეთავაზება')).toBeInTheDocument();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'არჩევა და დანიშვნა' })); });
        expect(post).toHaveBeenCalledWith('/match-arrangements/12/official-request/select', { refereeId: 23, revision: 7 });
    } finally { await act(async () => { await i18n.changeLanguage('en'); }); }
});
