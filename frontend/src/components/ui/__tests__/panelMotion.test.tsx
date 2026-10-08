import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../ConfirmDialog';
import { MotionDisclosure } from '../MotionDisclosure';

const dismissed = vi.fn();
function Page() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open details</button><ConfirmDialog open={open} title="Details" message="Review the details" onConfirm={vi.fn()} onCancel={() => { dismissed(); setOpen(false); }} /></>;
}
function openPanel() {
    const view = render(<Page />), trigger = screen.getByRole('button', { name: 'Open details' });
    trigger.focus(); fireEvent.click(trigger); act(() => vi.advanceTimersByTime(0));
    return { ...view, trigger };
}
beforeEach(() => { vi.useFakeTimers(); dismissed.mockClear(); vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('application panel continuity', () => {
    it('keeps background isolation through dismissal, returns focus, and can reopen', () => {
        const { trigger } = openPanel();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.getByRole('dialog')).toHaveAttribute('data-closing', 'true');
        expect(document.body.style.overflow).toBe('hidden');
        act(() => vi.advanceTimersByTime(260));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus(); expect(document.body.style.overflow).not.toBe('hidden');
        fireEvent.click(trigger); expect(screen.getByRole('dialog')).toHaveAttribute('data-closing', 'false');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        act(() => vi.advanceTimersByTime(260)); expect(dismissed).toHaveBeenCalledTimes(2);
    });
    it('ignores repeated dismissal and descendant animation events', () => {
        openPanel(); fireEvent.keyDown(document, { key: 'Escape' }); fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.animationEnd(screen.getByText('Review the details'), { animationName: 'app-dialog-exit' });
        expect(dismissed).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(260)); expect(dismissed).toHaveBeenCalledTimes(1);
    });
    it('dismisses immediately for reduced motion', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true })); const { trigger } = openPanel();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
    });
    it('cancels a pending dismissal on navigation or session teardown', () => {
        const view = openPanel(); fireEvent.keyDown(document, { key: 'Escape' }); view.unmount();
        act(() => vi.advanceTimersByTime(300)); expect(dismissed).not.toHaveBeenCalled();
        expect(document.body.style.overflow).not.toBe('hidden');
    });
    it('retains expanded content and its draft while collapsed content is inert', () => {
        const view = render(<MotionDisclosure open={false}><input aria-label="Draft" defaultValue="" /></MotionDisclosure>);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        view.rerender(<MotionDisclosure open><input aria-label="Draft" defaultValue="" /></MotionDisclosure>);
        const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'Keep this draft' } });
        view.rerender(<MotionDisclosure open={false}><input aria-label="Draft" defaultValue="" /></MotionDisclosure>);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument(); expect(input.closest('[inert]')).not.toBeNull();
        view.rerender(<MotionDisclosure open><input aria-label="Draft" defaultValue="" /></MotionDisclosure>);
        expect(screen.getByRole('textbox')).toBe(input); expect(input).toHaveValue('Keep this draft');
    });
});
