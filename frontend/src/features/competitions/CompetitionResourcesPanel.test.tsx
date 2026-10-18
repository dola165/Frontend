import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { apiClient } from '../../api/axiosConfig';
import { CompetitionResourcesPanel } from './CompetitionResourcesPanel';
import type { CompetitionRules } from './api';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('./useCompetitionCommand', () => ({ useCompetitionCommand: () => ({ busy: false }) }));
it('shows freshly drawn slots without reloading and uses the published zone for their times', async () => {
    const rules = { timezone: 'America/New_York' } as CompetitionRules;
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { revision: 1, canOperate: false, fixtures: [] } });
    const view = (revision: number) => <MemoryRouter><CompetitionResourcesPanel id={10} rules={rules} revision={revision} changed={vi.fn()}/></MemoryRouter>;
    const { rerender } = render(view(1));
    await screen.findByText('Generate the timetable first.');
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { revision: 2, canOperate: false, fixtures: [{ id: 3, status: 'SCHEDULED', home_label: 'North', away_label: 'South', starts_at: '2027-01-10T05:30:00Z', appointments: [] }] } });
    rerender(view(2));
    await screen.findByText('North – South');
    await waitFor(() => expect(screen.queryByText('Generate the timetable first.')).not.toBeInTheDocument());
    expect(screen.getByRole('list')).toHaveTextContent(new Date('2027-01-10T05:30:00Z').toLocaleString('en', { timeZone: 'America/New_York' }));
});
