import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubMotionDialog } from '../ClubMotionDialog';

const closed = vi.fn();
function Page() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Open club panel</button>{open && <ClubMotionDialog label="Club details" onClose={() => { closed();setOpen(false); }}>{close => <><button onClick={close}>Close panel</button><span data-testid="child">Details</span></>}</ClubMotionDialog>}</>;
}
const open = () => { render(<Page/>);const trigger = screen.getByRole('button', { name:'Open club panel' });trigger.focus();fireEvent.click(trigger);act(() => vi.advanceTimersByTime(0));return trigger; };
beforeEach(() => { vi.useFakeTimers();closed.mockClear();vi.stubGlobal('matchMedia', () => ({ matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn() })); });
afterEach(() => { vi.useRealTimers();vi.unstubAllGlobals(); });
describe('club panel exits', () => {
  it('keeps focus and background isolation through the exit, then returns to its trigger', () => {
    const trigger=open(), dialog=screen.getByRole('dialog');
    fireEvent.click(screen.getByRole('button', {name:'Close panel'}));
    expect(dialog).toHaveAttribute('data-closing','true');expect(dialog).toBeVisible();
    expect(document.body.style.overflow).toBe('hidden');expect(trigger).not.toHaveFocus();
    act(() => vi.advanceTimersByTime(260));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(trigger).toHaveFocus();expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('ignores descendant and entrance animation events and completes the actual exit only once', () => {
    open();const dialog=screen.getByRole('dialog');fireEvent.click(screen.getByRole('button', {name:'Close panel'}));
    fireEvent.animationEnd(screen.getByTestId('child'), {animationName:'club-dialog-exit'});
    fireEvent.animationEnd(dialog, {animationName:'club-dialog-enter'});expect(closed).not.toHaveBeenCalled();
    fireEvent.animationEnd(dialog, {animationName:'club-dialog-exit'});act(() => vi.advanceTimersByTime(300));expect(closed).toHaveBeenCalledTimes(1);
  });
  it('handles repeated Escape and close requests without double completion', () => {
    open();fireEvent.keyDown(document,{key:'Escape'});fireEvent.keyDown(document,{key:'Escape'});fireEvent.click(screen.getByRole('button', {name:'Close panel'}));
    act(() => vi.advanceTimersByTime(260));expect(closed).toHaveBeenCalledTimes(1);
  });
  it('closes immediately for reduced motion and restores focus', () => {
    vi.stubGlobal('matchMedia', () => ({matches:true}));const trigger=open();fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(trigger).toHaveFocus();expect(closed).toHaveBeenCalledTimes(1);
  });
  it('cancels a delayed completion when the owning route or session unmounts', () => {
    const view=render(<Page/>);fireEvent.click(screen.getByRole('button',{name:'Open club panel'}));fireEvent.keyDown(document,{key:'Escape'});view.unmount();
    act(() => vi.advanceTimersByTime(300));expect(closed).not.toHaveBeenCalled();expect(document.body.style.overflow).not.toBe('hidden');
  });
});
