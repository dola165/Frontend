import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { DolaPet } from './DolaPet';
import { useGuideTask, usePetAnswer } from './bridge';

const save = vi.hoisted(() => vi.fn());
vi.mock('./copy', () => ({ useGuideCopy: () => (text: string) => text }));
vi.mock('../copy', () => ({ usePagesCopy: () => (text: string) => text }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 }, sessionId: 'session1' }) }));
vi.mock('./useGuidePlacement', () => ({ useGuidePlacement: () => ({ host: document.body, inline: false, left: 12, top: 12, maxHeight: 800 }) }));
vi.mock('../edit/context', () => ({
  SETUP_PANEL: { squads: 'squads' },
  usePageEdit: () => ({ editing: true, panel: 'squads', page: { ref: { type: 'club', id: 1 }, kind: 'CLUB', status: 'DRAFT', setup: { items: [{key:'squads', done:false}], next:'squads' }, goLive: {ready:true} } }),
}));
function SquadEditor() {
  const [years, setYears] = useState<string[]>([]);
  usePetAnswer('squads', text => {
    if (!/^20\d{2}$/.test(text)) return null;
    setYears([text]); return text;
  });
  useGuideTask('squads', { disabled: !years.length, next: async () => {
    return {status: await save(years) ? 'complete' : 'stay'};
  } });
  return <p>Chosen years: {years.join(', ')}</p>;
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
it('one Next applies a typed answer through the editor state and saves that answer', async () => {
  save.mockResolvedValue(true);
  render(<MemoryRouter><SquadEditor /><DolaPet /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Birth years, like 2015, 2016 boys'), {target:{value:'2015'}});
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  await waitFor(() => expect(save).toHaveBeenCalledWith(['2015']));
  expect(save).toHaveBeenCalledTimes(1);
});
it('an unrecognized typed answer does not save or move forward', async () => {
  render(<MemoryRouter><SquadEditor /><DolaPet /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Birth years, like 2015, 2016 boys'), {target:{value:'invalid'}});
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  await screen.findByText('Choose a matching option in the editor.');
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Birth years, like 2015, 2016 boys')).toHaveValue('invalid');
});
