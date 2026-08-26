import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '../../../../i18n';
import { DecisionNoteModal } from '../DecisionNoteModal';

const baseProps = {
    title: 'Accept application',
    subtitle: 'Add trial instructions.',
    saving: false,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
};

describe('DecisionNoteModal — phase A2', () => {
    it('fills the textarea with the suggested template on chip click', () => {
        render(<DecisionNoteModal {...baseProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Use template' }));
        const textarea = screen.getByLabelText(/Note to the player/) as HTMLTextAreaElement;
        expect(textarea.value).toContain('Thursday 18:00, pitch 2. Bring boots, shin pads and water.');
        expect(textarea.value).toContain('Parents must attend.');
    });

    it('enforces the 1000-character limit and shows the counter', () => {
        render(<DecisionNoteModal {...baseProps} />);
        const textarea = screen.getByLabelText(/Note to the player/) as HTMLTextAreaElement;
        expect(textarea.maxLength).toBe(1000);
        fireEvent.change(textarea, { target: { value: 'Thursday 18:00' } });
        expect(screen.getByText('14/1000')).toBeInTheDocument();
    });

    it('confirms with null when the note is empty', () => {
        render(<DecisionNoteModal {...baseProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        expect(baseProps.onConfirm).toHaveBeenCalledWith(null);
    });

    it('confirms with the trimmed note text', () => {
        render(<DecisionNoteModal {...baseProps} />);
        const textarea = screen.getByLabelText(/Note to the player/) as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: '  Thursday 18:00, pitch 2.  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        expect(baseProps.onConfirm).toHaveBeenCalledWith('Thursday 18:00, pitch 2.');
    });

    it('closes via cancel', () => {
        render(<DecisionNoteModal {...baseProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(baseProps.onClose).toHaveBeenCalled();
    });

    it('phase A6: fills the decline template and uses the custom decline label', () => {
        render(
            <DecisionNoteModal
                {...baseProps}
                confirmLabel="Decline"
                danger
                templateKey="decisions.declineTemplate"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Use template' }));
        const textarea = screen.getByLabelText(/Note to the player/) as HTMLTextAreaElement;
        expect(textarea.value).toContain('Thank you for applying');
        expect(textarea.value).toContain('please try again at our next tryouts');
        expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    });
});
