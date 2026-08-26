import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog noteField — phase A2 release message', () => {
    it('renders the note textarea and reports changes', () => {
        const onChange = vi.fn();
        render(
            <ConfirmDialog
                open
                title="Remove Player"
                message="Remove this player from the club?"
                variant="danger"
                noteField={{ label: 'Note to the player (optional)', value: '', onChange }}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        const textarea = screen.getByLabelText('Note to the player (optional)') as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Keep training!' } });
        expect(onChange).toHaveBeenCalledWith('Keep training!');
    });

    it('omits the textarea when no noteField is provided', () => {
        render(
            <ConfirmDialog
                open
                title="Confirm"
                message="Are you sure?"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        expect(screen.queryByLabelText(/Note to the player/)).toBeNull();
    });
});
