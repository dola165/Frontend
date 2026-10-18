import '../../../../i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makePage } from '../../__tests__/fixtures';
import { reverseGeocode } from '../../api';
import { PageEditContext, type PageEdit } from '../context';
import { GroundsPanel } from '../panels/GroundsPanel';
import { IdentityPanel } from '../panels/IdentityPanel';
type Address = Awaited<ReturnType<typeof reverseGeocode>>;

const captured = vi.hoisted(() => ({ map: null as null | { places: unknown[]; pending: unknown; onDrop: (lat: number, lng: number) => void } }));
vi.mock('../panels/GroundsMap', () => ({ default: (props: typeof captured.map) => { captured.map = props; return <div data-testid="ground-map" />; } }));
vi.mock('../../api', async original => ({ ...await original<typeof import('../../api')>(), fetchPitches: vi.fn().mockResolvedValue([]), reverseGeocode: vi.fn().mockResolvedValue({ address: 'Confirmed street' }) }));

function mount(element: React.ReactNode, page = makePage({ kind: 'CLUB' })) {
  const saveIdentity = vi.fn().mockResolvedValue(true), saveBox = vi.fn().mockResolvedValue(true), closePanel = vi.fn();
  const context = { page, saveIdentity, saveBox, closePanel } as unknown as PageEdit;
  render(<MemoryRouter><PageEditContext.Provider value={context}>{element}</PageEditContext.Provider></MemoryRouter>);
  return { saveIdentity, saveBox };
}
beforeEach(() => { captured.map = null; vi.mocked(reverseGeocode).mockReset().mockResolvedValue({ address: 'Confirmed street', town: null }); });

it('sends the coordinates of the selected town so the real backend can move its map', async () => {
  const user = userEvent.setup();
  const { saveIdentity } = mount(<IdentityPanel />);
  await user.click(screen.getByRole('button', { name: 'Batumi' }));
  await user.click(screen.getByRole('button', { name: 'Done' }));
  expect(saveIdentity).toHaveBeenCalledWith(expect.objectContaining({ town: { name: 'Batumi', latitude: 41.6168, longitude: 41.6367 } }), expect.anything());
});

it('keeps an address-only facility without drawing a made-up pin and lets its owner place it', async () => {
  const page = makePage({ kind: 'CLUB' });
  page.boxes.grounds.items = [{ id: 84, name: 'Existing ground', address: 'Recorded address', town: 'Rustavi', latitude: null, longitude: null, surface: 'ARTIFICIAL', size: '7v7', indoor: false, pitchId: null, venueId: null }];
  const { saveBox } = mount(<GroundsPanel />, page);
  await screen.findByTestId('ground-map');
  expect(screen.getByText('Existing ground')).toBeInTheDocument();
  expect(captured.map?.places).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Move on the map' }));
  expect(captured.map?.pending).toBeNull();
  await act(async () => { captured.map?.onDrop(41.7, 44.8); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'This is it' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'This is it' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(saveBox).toHaveBeenCalledWith('grounds', { items: [expect.objectContaining({ id: 84, latitude: 41.7, longitude: 44.8 })] }, expect.anything()));
});

it('does not invent a pin, surface or pitch format when a ground is added by name', async () => {
  const { saveBox } = mount(<GroundsPanel />);
  await screen.findByTestId('ground-map');
  fireEvent.change(screen.getByPlaceholderText('Its name'), { target: { value: 'School field' } });
  fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));
  expect(captured.map?.pending).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(saveBox).toHaveBeenCalledWith('grounds', { items: [expect.objectContaining({ latitude: null, longitude: null, surface: 'UNKNOWN', size: 'OTHER' })] }, expect.anything()));
});

it('ignores an older address response when the pin moves horizontally', async () => {
  let first!: (value: Address) => void, latest!: (value: Address) => void;
  vi.mocked(reverseGeocode).mockImplementationOnce(() => new Promise(resolve => { first = resolve; })).mockImplementationOnce(() => new Promise(resolve => { latest = resolve; }));
  mount(<GroundsPanel />); await screen.findByTestId('ground-map');
  act(() => { captured.map?.onDrop(41.7, 44.8); });
  act(() => { captured.map?.onDrop(41.7, 44.9); });
  await act(async () => { latest({ address: 'Latest spot', town: null }); });
  await act(async () => { first({ address: 'Old spot', town: null }); });
  expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('Latest spot');
});

it('finishes an unknown address lookup and preserves an address entered while waiting', async () => {
  let answer!: (value: Address) => void;
  vi.mocked(reverseGeocode).mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
  mount(<GroundsPanel />); await screen.findByTestId('ground-map');
  act(() => { captured.map?.onDrop(41.7, 44.8); });
  expect(screen.getByPlaceholderText('Finding the address…')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), { target: { value: 'Our recorded address' } });
  await act(async () => { answer({ address: null, town: null }); });
  expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('Our recorded address');
  expect(screen.getByPlaceholderText('Street, town')).toBeInTheDocument();
});

it('does not replace a manually entered address with a slower venue lookup', async () => {
  let answer!: (value: Address) => void;
  vi.mocked(reverseGeocode).mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
  mount(<GroundsPanel />); await screen.findByTestId('ground-map');
  act(() => { captured.map?.onDrop(41.7, 44.8); });
  fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), { target: { value: 'Manual entrance address' } });
  await act(async () => { answer({ address: 'Venue main entrance', town: null }); });
  expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('Manual entrance address');
});
