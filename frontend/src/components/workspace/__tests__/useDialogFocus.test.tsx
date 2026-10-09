import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const PortalDialog = ({ name, children }: { name: string; children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(true, ref);
    return createPortal(<div ref={ref} role="dialog" aria-label={name}>{children}</div>, document.body);
};

const NestedHarness = () => {
    const [open, setOpen] = useState(false);
    const [childOpen, setChildOpen] = useState(false);
    return <>
        <button onClick={() => setOpen(true)}>Open parent</button>
        {open && <PortalDialog name="Parent">
            <button onClick={() => setChildOpen(true)}>Open child</button>
            {childOpen && <PortalDialog name="Child"><button onClick={() => setOpen(false)}>Close both</button></PortalDialog>}
        </PortalDialog>}
    </>;
};

describe('useDialogFocus', () => {
    it('restores the background when parent and nested dialogs close in the same update', async () => {
        const nativeFocus = HTMLElement.prototype.focus;
        const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options) {
            // Browsers refuse focus anywhere inside an inert branch; jsdom does not.
            if (this.inert) return;
            for (let node = this.parentElement; node; node = node.parentElement) if (node.inert) return;
            nativeFocus.call(this, options);
        });
        const user = userEvent.setup();
        const view = render(<NestedHarness />);
        await user.click(screen.getByRole('button', { name: 'Open parent' }));
        await user.click(screen.getByRole('button', { name: 'Open child' }));
        expect(view.container).toHaveAttribute('aria-hidden', 'true');
        expect(view.container.inert).toBe(true);
        await user.click(screen.getByRole('button', { name: 'Close both' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(view.container).not.toHaveAttribute('aria-hidden');
        expect(view.container.inert).not.toBe(true);
        expect(screen.getByRole('button', { name: 'Open parent' })).toHaveFocus();
        expect(document.body.style.overflow).toBe('');
        focus.mockRestore();
    });
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
