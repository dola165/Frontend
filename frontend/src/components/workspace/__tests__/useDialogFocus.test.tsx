import { useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDialogFocus } from '../useDialogFocus';

const DialogHarness = () => {
    const [open, setOpen] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(open, dialogRef, () => setOpen(false));

    return (
        <div>
            <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
            {open && (
                <div>
                    <div ref={dialogRef} role="dialog" aria-label="Test dialog">
                        <button type="button">First action</button>
                        <button type="button">Last action</button>
                    </div>
                </div>
            )}
        </div>
    );
};

describe('useDialogFocus', () => {
    it('isolates the background, traps Tab, closes on Escape and restores focus', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);
        const trigger = screen.getByRole('button', { name: 'Open dialog' });

        await user.click(trigger);
        const first = screen.getByRole('button', { name: 'First action' });
        const last = screen.getByRole('button', { name: 'Last action' });
        await waitFor(() => expect(first).toHaveFocus());
        expect(trigger).toHaveProperty('inert', true);
        expect(document.body.style.overflow).toBe('hidden');

        last.focus();
        await user.tab();
        expect(first).toHaveFocus();
        await user.tab({ shift: true });
        expect(last).toHaveFocus();

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
        expect(trigger.inert).not.toBe(true);
        expect(trigger).not.toHaveAttribute('aria-hidden');
        expect(document.body.style.overflow).toBe('');
    });
});
