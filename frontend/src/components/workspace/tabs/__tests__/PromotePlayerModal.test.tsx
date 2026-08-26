import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../../../i18n';
import { PromotePlayerModal } from '../PromotePlayerModal';
import type { ClubPlayerAffiliation } from '../../../../features/clubs/domain';

vi.mock('../../../../api/axiosConfig', () => ({
    apiClient: {
        get: vi.fn(),
    },
}));

import { apiClient } from '../../../../api/axiosConfig';

const player: ClubPlayerAffiliation = {
    userId: 7,
    fullName: 'Giorgi Trialist',
    username: 'giorgi.trial',
    status: 'TRIALIST',
    primary: false,
    joinedAt: '2026-08-10T10:00:00',
    trialEndsOn: '2026-09-01',
};

const baseProps = {
    clubId: 1,
    player,
    saving: false,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
};

const squadsResponse = [
    { id: 1, name: 'First Team', category: 'SENIOR', gender: 'MALE' },
    { id: 2, name: 'U15', category: 'U15', gender: 'MIXED' },
];

describe('PromotePlayerModal — phase A1', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiClient.get).mockResolvedValue({ data: squadsResponse });
    });

    it('loads and lists the club squads', async () => {
        render(<PromotePlayerModal {...baseProps} />);
        await waitFor(() => expect(screen.getByText('First Team')).toBeInTheDocument());
        expect(screen.getByText('U15')).toBeInTheDocument();
    });

    it('keeps confirm disabled until a squad is selected', async () => {
        render(<PromotePlayerModal {...baseProps} />);
        const confirm = screen.getByRole('button', { name: 'Promote' });
        await waitFor(() => expect(screen.getByText('First Team')).toBeInTheDocument());
        expect(confirm).toBeDisabled();
        fireEvent.click(screen.getByText('U15'));
        expect(confirm).not.toBeDisabled();
    });

    it('calls onConfirm with the selected squad and the prefilled trial date', async () => {
        render(<PromotePlayerModal {...baseProps} />);
        await waitFor(() => expect(screen.getByText('U15')).toBeInTheDocument());
        fireEvent.click(screen.getByText('U15'));
        fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
        expect(baseProps.onConfirm).toHaveBeenCalledWith(2, '2026-09-01');
    });

    it('passes null trial date when the field is cleared', async () => {
        render(<PromotePlayerModal {...baseProps} />);
        await waitFor(() => expect(screen.getByText('First Team')).toBeInTheDocument());
        fireEvent.click(screen.getByText('First Team'));
        const input = screen.getByLabelText(/Trial ends/) as HTMLInputElement;
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
        expect(baseProps.onConfirm).toHaveBeenCalledWith(1, null);
    });

    it('shows the empty-squad hint when the club has no squads', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
        render(<PromotePlayerModal {...baseProps} />);
        await waitFor(() => expect(screen.getByText(/No squads yet/)).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Promote' })).toBeDisabled();
    });
});
