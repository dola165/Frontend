import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClubNumbers } from './ClubNumbers';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import '../../../i18n';

const roles = { squads: [{ id: 4, name: 'U12', player_count: 14 }] } as unknown as RolesWorkspace;

describe('ClubNumbers', () => {
    it('shows … for numbers that have not arrived instead of zeros', () => {
        render(<ClubNumbers clubId={1} overview={null} roles={roles} boot={null} tabs={[]} tryoutPending={0} onOpen={vi.fn()} />);
        expect(screen.getByText('1 squads · 14 players in them')).toBeInTheDocument();
        expect(screen.getAllByText('…')).toHaveLength(3);
        expect(screen.queryByText(/^0 /)).not.toBeInTheDocument();
    });
});
