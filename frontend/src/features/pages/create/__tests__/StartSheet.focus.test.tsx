import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SimilarPage } from '../../api';

const api = vi.hoisted(() => ({ fetchSimilar: vi.fn(), createPage: vi.fn() }));
vi.mock('../../api', () => api);
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9500, dob: '1985-05-02' }, status: 'authenticated', refreshNavigationCapabilities: vi.fn() }) }));
vi.mock('../../../start/startApi', () => ({ fetchSavedTown: vi.fn().mockResolvedValue({ name: 'Rustavi', latitude: 41.5495, longitude: 45.0012 }) }));
import { StartSheet } from '../StartSheet';

const listing: SimilarPage = { ref: { type: 'club', id: 307 }, name: 'Rustavi Metallurgi Kids', town: 'Rustavi', kind: 'CLUB', crestUrl: null, status: 'LIVE', mine: false, exact: false };
const restored = () => sessionStorage.setItem('gk.first-use.v1:9500:page-start', JSON.stringify({ accountId: 9500, value: { kind: 'CLUB', name: 'Saved draft', town: 'Rustavi' } }));
function delayedEntryFrame() {
  let next = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callbacks.set(++next, callback); return next; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id); });
  return () => act(() => {
    const frame = [...callbacks.values()]; callbacks.clear();
    expect(frame).toHaveLength(1);
    frame.forEach(callback => callback(performance.now()));
  });
}
function mount(kind: 'CLUB' | null = 'CLUB') {
  render(<MemoryRouter><StartSheet kind={kind} from="home" draw={false} onClose={vi.fn()} /></MemoryRouter>);
}
beforeEach(() => { sessionStorage.clear(); api.fetchSimilar.mockReset().mockResolvedValue([listing]); api.createPage.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

it.each(['preset', 'chosen'] as const)('keeps fast input before delayed entry focus for a %s club and looks up the full name', async entry => {
  const user = userEvent.setup();
  const focusFrame = delayedEntryFrame();
  mount(entry === 'preset' ? 'CLUB' : null);
  if (entry === 'chosen') await user.click(screen.getByRole('radio', { name: 'Club' }));
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Club name' });
  await user.type(input, 'M');
  expect(input).toHaveValue('M');
  focusFrame();
  await user.keyboard('etalurgi');
  await screen.findByText('Looking for one of these?');
  expect({ value: input.value, lookup: api.fetchSimilar.mock.calls.at(-1)?.[0] }).toEqual({ value: 'Metalurgi', lookup: 'Metalurgi' });
  expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/clubs/307');
  expect(api.createPage).not.toHaveBeenCalled();
});

it('does not refocus or select a restored draft after the person has already edited it and moved on', async () => {
  const user = userEvent.setup(); restored();
  const focusFrame = delayedEntryFrame(); mount();
  const input = screen.getByRole('textbox', { name: 'Club name' });
  await user.clear(input); await user.type(input, 'M');
  const town = screen.getByRole('button', { name: 'Change town' });
  await user.click(town);
  expect(town).toHaveFocus();
  focusFrame();
  expect(town).toHaveFocus();
  expect(input).toHaveValue('M');
  await user.click(input); await user.keyboard('etalurgi');
  expect(input).toHaveValue('Metalurgi');
  expect(api.createPage).not.toHaveBeenCalled();
});

it('still selects an untouched restored draft so typing replaces it without submitting', async () => {
  const user = userEvent.setup(); restored();
  const focusFrame = delayedEntryFrame(); mount();
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Not now' })[0]).toHaveFocus());
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Club name' });
  focusFrame();
  expect(input).toHaveFocus();
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Saved draft'.length]);
  await user.keyboard('Replacement name');
  expect(input).toHaveValue('Replacement name');
  expect(api.createPage).not.toHaveBeenCalled();
});
