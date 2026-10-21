import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BroadcastPanel } from './BroadcastPanel';
import { broadcastRequest, safePlayerUrl, type Broadcast } from './api';
import type { Match } from '../matchExchange/api';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'broadcast-session' }) }));
vi.mock('./api', async original => ({ ...(await original<typeof import('./api')>()), broadcastRequest: vi.fn() }));
vi.mock('./StreamPlayer', () => ({ StreamPlayer: () => <iframe title="Test broadcast player" /> }));
const match = { event_id: 19, title: 'Dinamo meeting showcase' } as Match;
const b: Broadcast = { id: 'abc', eventId: 19, squadId: 7, clubId: 3, title: match.title, state: 'DRAFT', audience: 'MATCH_VIEWERS', revision: 0, sourceRevision: 0, canManage: true, streamingEnabled: false, setupName: 'GrassKickZ broadcast abc', checkedAt: null, recordings: [] };
beforeEach(() => { vi.resetAllMocks(); localStorage.setItem('gk-session-id', 'broadcast-session'); });
it('prepares without loading a player or exposing source fields while disabled', async () => {
  vi.mocked(broadcastRequest).mockResolvedValue({ broadcasts: [b], manageableSquads: [{ id: 7, name: 'Dinamo U12' }] });
  render(<BroadcastPanel match={match} />);
  expect(await screen.findByText('Preparation is saved. Streaming activation is pending.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Watch broadcast' })).not.toBeInTheDocument();
  expect(screen.queryByTitle('Test broadcast player')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Dedicated Live Input ID')).not.toBeInTheDocument();
});
it('requires filming permission and retries a failed save with the same request identity', async () => {
  vi.mocked(broadcastRequest).mockImplementation(async method => { if (method === 'get') return { broadcasts: [], manageableSquads: [{ id: 7, name: 'Dinamo U12' }] }; throw Error('Network unavailable'); });
  render(<BroadcastPanel match={match} />);
  expect(await screen.findByText('No broadcast has been shared yet.')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Prepare a broadcast'));
  const save = screen.getByRole('button', { name: 'Save broadcast preparation' });
  expect(save).toBeDisabled(); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save);
  await screen.findByText('Could not save broadcast preparation.'); fireEvent.click(save);
  await waitFor(() => expect(vi.mocked(broadcastRequest).mock.calls.filter(args => args[0] === 'post')).toHaveLength(2));
  const posts = vi.mocked(broadcastRequest).mock.calls.filter(args => args[0] === 'post');
  expect(posts[0][4]).toEqual(posts[1][4]);
});
it('loads signed playback only after viewer intent and removes the player on close', async () => {
  const value = { ...b, state: 'LIVE' as const, streamingEnabled: true, sourceRevision: 1, canManage: false };
  vi.mocked(broadcastRequest).mockImplementation(async method => method === 'get' ? { broadcasts: [value], manageableSquads: [] } : { iframeUrl: 'https://customer-test.cloudflarestream.com/signed-header.signed-payload.signed-signature/iframe', expiresAt: new Date(Date.now() + 300000).toISOString() });
  render(<BroadcastPanel match={match} />);
  const watch = await screen.findByRole('button', { name: 'Watch broadcast' });
  expect(screen.queryByTitle('Test broadcast player')).not.toBeInTheDocument();
  expect(vi.mocked(broadcastRequest).mock.calls).toHaveLength(1);
  fireEvent.click(watch); expect(await screen.findByTitle('Test broadcast player')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close video' }));
  expect(screen.queryByTitle('Test broadcast player')).not.toBeInTheDocument();
});
it('rejects foreign origins, credentials, unsigned IDs and expired token URLs', () => {
  const expiresAt = new Date(Date.now() + 300000).toISOString();
  for (const url of ['https://evil.test/signed-header.signed-payload.signed-signature/iframe', 'https://customer-test.cloudflarestream.com.evil.test/signed-header.signed-payload.signed-signature/iframe', 'http://customer-test.cloudflarestream.com/signed-header.signed-payload.signed-signature/iframe', 'https://user:pass@customer-test.cloudflarestream.com/signed-header.signed-payload.signed-signature/iframe', 'https://customer-test.cloudflarestream.com/' + 'a'.repeat(32) + '/iframe']) expect(() => safePlayerUrl({ iframeUrl: url, expiresAt })).toThrow();
  expect(() => safePlayerUrl({ iframeUrl: 'https://customer-test.cloudflarestream.com/signed-header.signed-payload.signed-signature/iframe', expiresAt: new Date(Date.now() - 1).toISOString() })).toThrow();
});
it('rejects a late playback response after unmount', async () => {
  let resolve: (value: unknown) => void = () => {};
  vi.mocked(broadcastRequest).mockImplementation(async method => method === 'get' ? { broadcasts: [{ ...b, streamingEnabled: true, sourceRevision: 1 }], manageableSquads: [] } : new Promise(next => { resolve = next; }));
  const view = render(<BroadcastPanel match={match} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Watch broadcast' }));
  view.unmount(); resolve({ iframeUrl: 'https://customer-test.cloudflarestream.com/signed-header.signed-payload.signed-signature/iframe', expiresAt: new Date(Date.now() + 300000).toISOString() });
  expect(screen.queryByTitle('Test broadcast player')).not.toBeInTheDocument();
});
