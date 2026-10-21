import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StreamPlayer } from './StreamPlayer';

beforeEach(() => { delete window.Stream; });
afterEach(() => { delete window.Stream; });
const playback = () => ({ iframeUrl: 'https://customer-test.cloudflarestream.com/signed-header.signed-payload.signed-signature/iframe', expiresAt: new Date(Date.now() + 300000).toISOString() });
it('reports readiness from media events and shows provider failures with retry', async () => {
  const events = new Map<string, () => void>();
  window.Stream = () => ({ addEventListener: (event, listener) => { events.set(event, listener); }, pause: vi.fn() });
  const retry = vi.fn(); render(<StreamPlayer playback={playback()} title="Dinamo" retry={retry} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading video');
  expect(screen.getByTitle('Dinamo video player')).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await waitFor(() => expect(events.has('loadeddata')).toBe(true));
  fireEvent.load(screen.getByTitle('Dinamo video player'));
  expect(screen.getByRole('status')).toHaveTextContent('Loading video');
  const { act } = await import('@testing-library/react');
  act(() => events.get('loadeddata')?.()); expect(screen.getByRole('status')).toHaveTextContent('Video ready');
  act(() => events.get('error')?.()); expect(screen.getByRole('alert')).toHaveTextContent('could not play');
  expect(screen.queryByTitle('Dinamo video player')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry video' })); expect(retry).toHaveBeenCalledOnce();
});
it('pauses and detaches the player when leaving the view', async () => {
  const pause = vi.fn(), removeEventListener = vi.fn();
  window.Stream = () => ({ addEventListener: vi.fn(), pause, removeEventListener });
  const view = render(<StreamPlayer playback={playback()} title="Dinamo" retry={vi.fn()} />);
  await waitFor(() => expect(window.Stream).toBeDefined());
  await Promise.resolve(); view.unmount();
  expect(pause).toHaveBeenCalledOnce(); expect(removeEventListener).toHaveBeenCalledTimes(2);
});
