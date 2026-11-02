import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bootstrap } from './api';
import { OperationsSettings } from './OperationsSettings';
import { useClubOperations } from './useClubOperations';

// Release 17 holds Life (private wellbeing) back: the server lists `care.life` only while its switch is on.
const door = { id: 'care.life', context: { type: 'user', id: 7, label: 'Life' } };
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
const auth = vi.hoisted(() => ({ status: 'authenticated', user: { id: 7, navigationCapabilities: { version: 1, workspaces: [] as unknown[] } } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

// A club that never saved its tools, as the server answered before the switch: Life on with the rest.
const boot: Bootstrap = {
  clubId: 1, clubName: 'Academy', actorId: 7, leadership: true,
  definitions: [
    { module: 'MEDICAL', kind: 'CLINICAL_NOTE', label: 'Clinical note', states: ['OPEN'], fields: [] },
    { module: 'WELLBEING', kind: 'WELLBEING_NOTE', label: 'Private wellbeing note', states: ['OPEN'], fields: [] },
  ],
  specialisations: [], permissions: ['MEDICAL:WRITE', 'WELLBEING:READ', 'WELLBEING:WRITE'],
  settings: { setting: 'UNSPECIFIED', playing_level: 'UNSPECIFIED', enabled_modules: ['MEDICAL', 'WELLBEING', 'AVAILABILITY'], revision: 0 },
  modules: [{ id: 'MEDICAL', writable: true, globalWrite: true, writeSquads: [] }, { id: 'WELLBEING', writable: true, globalWrite: true, writeSquads: [] }],
  squads: [], people: [], staff: [], guardians: [], events: [], sessions: [], venues: [],
  links: [{ id: 3, title: 'Life consent', module: 'WELLBEING', kind: 'WELLBEING_CONSENT', squad_id: null }],
};
beforeEach(() => {
  vi.clearAllMocks();
  auth.user.navigationCapabilities.workspaces = [];
  api.get.mockResolvedValue({ data: boot });
});

/** Club office's own view of the club: the tools the person holds and the Club tools switches. */
function Office() {
  const { boot: shown } = useClubOperations(1);
  if (!shown) return <p role="status">Loading</p>;
  return <>
    <output aria-label="Tools">{[...shown.modules.map(m => m.id), ...shown.definitions.map(d => d.kind), ...shown.permissions, ...shown.links.map(l => l.kind), ...shown.settings.enabled_modules].join(' ')}</output>
    <OperationsSettings boot={shown} onSaved={async () => undefined} />
  </>;
}

describe('Life switched off (release 17 default)', () => {
  it('shows no Life tool, record, job tool or Club tools switch, while Body stays', async () => {
    render(<Office />);
    const tools = await screen.findByRole('status', { name: 'Tools' });
    expect(tools.textContent).toContain('MEDICAL');
    expect(tools.textContent).not.toContain('WELLBEING');
    expect(screen.getByRole('switch', { name: /Medical coordination/ })).toBeChecked();
    expect(screen.queryByRole('switch', { name: /Private wellbeing/ })).not.toBeInTheDocument();
  });
});

describe('Life switched on', () => {
  beforeEach(() => { auth.user.navigationCapabilities.workspaces = [door]; });
  it('shows Life with the club’s tools and its switch', async () => {
    render(<Office />);
    const tools = await screen.findByRole('status', { name: 'Tools' });
    expect(tools.textContent).toContain('WELLBEING_NOTE');
    expect(screen.getByRole('switch', { name: /Private wellbeing/ })).toBeChecked();
  });
});
