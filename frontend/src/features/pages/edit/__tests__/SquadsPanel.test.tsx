import { InlineText } from '../InlineText';
import '../../../../i18n';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makePage } from '../../__tests__/fixtures';
import { SquadsPanel } from '../panels/SquadsPanel';
import { PageEditContext, type PageEdit } from '../context';
import { runGuideTask } from '../../guide/taskBridge';

const saved = { id: 84, name: 'U12 Boys', ageGroup: 'U12', gender: 'MALE' as const, days: [2, 4], time: '18:30', groundId: 71, players: 0, coach: null, format: '7v7' };
const saveBox = vi.fn(), closePanel = vi.fn();
function mount() {
  const page = makePage({ kind: 'CLUB' });
  page.boxes.squads.items = [saved];
  const context = { page, saveBox, closePanel } as unknown as PageEdit;
  return render(<MemoryRouter><PageEditContext.Provider value={context}><SquadsPanel /></PageEditContext.Provider></MemoryRouter>);
}
beforeEach(() => { vi.resetAllMocks(); });

it('identifies teams without schedule controls and preserves saved schedules when renaming', async () => {
  const user = userEvent.setup();
  saveBox.mockResolvedValue(true);
  mount();
  expect(screen.queryByRole('group', { name: 'Training days' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/time/i)).not.toBeInTheDocument();
  await user.clear(screen.getByRole('textbox', { name: 'Team name' }));
  await user.type(screen.getByRole('textbox', { name: 'Team name' }), 'Lions 2015');
  await user.click(screen.getByRole('button', { name: 'Done' }));
  expect(saveBox).toHaveBeenCalledWith('squads', { items: [{ id: 84, name: 'Lions 2015', ageGroup: 'U12', gender: 'MALE', days: [2, 4], time: '18:30', groundId: 71 }] }, { label: 'Teams saved' });
  expect(closePanel).toHaveBeenCalledTimes(1);
});

it('retains the draft after a refused save and only completes the guide after retry succeeds', async () => {
  saveBox.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  mount();
  let result;
  await act(async () => { result = await runGuideTask('squads'); });
  expect(result).toEqual({ status: 'stay' });
  expect(closePanel).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'Team name' })).toHaveValue('U12 Boys');
  await act(async () => { result = await runGuideTask('squads'); });
  expect(result).toEqual({ status: 'complete' });
  expect(closePanel).toHaveBeenCalledTimes(1);
});



it('keeps a rejected inline name and permits retry without retyping', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<InlineText value="Lions" placeholder="Name" label="Name" onSave={onSave} />);
  await user.click(screen.getByRole('button', { name: 'Edit Name' }));
  await user.clear(screen.getByRole('textbox', { name: 'Name' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Rustavi Lions{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Not saved');
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Rustavi Lions');
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('button', { name: 'Edit Name' })).toBeInTheDocument();
  expect(onSave).toHaveBeenCalledTimes(2);
});
