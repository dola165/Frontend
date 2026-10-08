import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../../api/axiosConfig';
import { ImportMapping } from './ImportMapping';
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() } }));
const table = { sheets: ['Venues', 'Sponsors'], sheet: 'Venues', columns: ['Name', 'City'], rows: [['Ground A', 'Tbilisi'], ['Ground B', 'Batumi']], rowNumbers: [4, 9] };
const fields = [{ key: 'name', label: 'Name', required: true }, { key: 'city', label: 'City' }];
beforeEach(() => { vi.resetAllMocks(); vi.mocked(apiClient.post).mockResolvedValue({ data: table }); });
it('maps file values with source row numbers and preserves the selected worksheet', async () => {
  const onMapped = vi.fn(), user = userEvent.setup(); render(<ImportMapping fields={fields} onMapped={onMapped} />);
  await user.upload(screen.getByLabelText('Choose file'), new File(['data'], 'venues.xlsx'));
  await user.click(await screen.findByRole('button', { name: 'Validate mapped rows' }));
  expect(onMapped).toHaveBeenCalledWith([{ name: 'Ground A', city: 'Tbilisi' }, { name: 'Ground B', city: 'Batumi' }], [4, 9]);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Worksheet' }), 'Sponsors');
  expect((vi.mocked(apiClient.post).mock.calls[1][1] as FormData).get('sheet')).toBe('Sponsors');
});
it('retains the actual chosen source row for one organization', async () => {
  const onMapped = vi.fn(), user = userEvent.setup(); render(<ImportMapping fields={fields} single onMapped={onMapped} />);
  await user.upload(screen.getByLabelText('Choose file'), new File(['data'], 'venues.csv'));
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Choose the organization row' }), '1');
  await user.click(screen.getByRole('button', { name: 'Use this row in the form' }));
  expect(onMapped).toHaveBeenCalledWith([{ name: 'Ground B', city: 'Batumi' }], [9]);
});
it('requires unique mapped columns', async () => {
  const user = userEvent.setup(); render(<ImportMapping fields={fields} onMapped={vi.fn()} />);
  await user.upload(screen.getByLabelText('Choose file'), new File(['data'], 'venues.csv'));
  await user.selectOptions(await screen.findByRole('combobox', { name: 'City' }), 'Name');
  expect(screen.getByRole('button', { name: 'Validate mapped rows' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('different source column');
});
