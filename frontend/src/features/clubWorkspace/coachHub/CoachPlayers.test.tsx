import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { CoachPlayers } from './CoachPlayers';
import type { CoachData } from './CoachWorkspace';

vi.mock('./WaitingForFamily', () => ({
    WaitingForFamily: ({ placed }: { placed: { fullName: string }[] }) => <ul aria-label="Waiting for the family">{placed.map(card => <li key={card.fullName}>{card.fullName}</li>)}</ul>,
}));
vi.mock('../squads/PlayerCard', () => ({ PlayerCard: ({ player }: { player: { name: string } }) => <p>{player.name}</p> }));
vi.mock('./RosterDialog', () => ({ RosterDialog: () => null }));
vi.mock('../../clubOperations/WorkspacePlayerPanel', () => ({ WorkspacePlayerPanel: () => null }));
vi.mock('./CoachVisuals', () => ({ SquadSwitch: () => null }));

const adult = { id: 1, name: 'Aleksandre Kurdadze', number: 1, position: 'GOALKEEPER', age: 21 };
const child = { id: 108, name: 'Nika Tsintsadze', number: 12, position: 'GOALKEEPER', age: 11 };
const data = (members: { id: number; name: string }[] | null) => ({
    clubId: 1, shown: [10], revision: 0, now: Date.now(), names: new Map([[10, 'U12 Mixed']]), roles: { leadership: false },
    rosters: [{ id: 10, error: '', groups: [{ label: 'Goalkeepers', players: [adult, child] }] }],
    squads: [{ id: 10, overview: members ? { players: members } : null, sessions: [], updates: [], failed: [], error: '' }],
    records: { rows: [] }, joining: { items: [], failed: false, refresh: vi.fn() }, refresh: vi.fn(),
}) as unknown as CoachData;

describe('CoachPlayers', () => {
    it('lists the squad’s members as its own page does; a child placed before the family’s yes waits apart', () => {
        render(<MemoryRouter><CoachPlayers data={data([{ id: 1, name: 'Aleksandre Kurdadze' }])} /></MemoryRouter>);
        expect(screen.getByText('Aleksandre Kurdadze')).toBeInTheDocument();
        const waiting = screen.getByRole('list', { name: 'Waiting for the family' });
        expect(waiting).toHaveTextContent('Nika Tsintsadze');
        expect(screen.getAllByText('Nika Tsintsadze')).toHaveLength(1);
    });

    it('keeps the whole roster when the squad’s page didn’t load', () => {
        render(<MemoryRouter><CoachPlayers data={data(null)} /></MemoryRouter>);
        expect(screen.getAllByText('Nika Tsintsadze')).toHaveLength(1);
        expect(screen.getByRole('list', { name: 'Waiting for the family' })).toBeEmptyDOMElement();
    });
});
