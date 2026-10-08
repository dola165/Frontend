import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SmoothSelect } from './SmoothSelect';
import { FamilyPlanWindow } from './FamilyPlanWindow';
vi.mock('./FamilyPlans', () => ({ FamilyPlans: () => <p>Published journeys</p> }));
afterEach(cleanup);
it('opens an animated list, selects by keyboard, and restores trigger focus', () => {
  const change = vi.fn(); render(<label>Club<SmoothSelect value="dinamo" onChange={change}><option value="dinamo">Dinamo</option><option value="riverside">Riverside</option></SmoothSelect></label>);
  const trigger = screen.getByRole('combobox', { name: 'Club' }); trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(screen.getByRole('listbox')).toBeVisible(); expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(trigger, { key: 'ArrowDown' }); fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(change).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: 'riverside' }) })); expect(trigger).toHaveFocus(); expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
it('keeps a disabled fieldset disabled even though its menu would be portalled', () => {
  render(<fieldset disabled><label>Squad<SmoothSelect value="1"><option value="1">U16</option></SmoothSelect></label></fieldset>);
  const trigger = screen.getByRole('combobox'); expect(trigger).toBeDisabled(); fireEvent.click(trigger); expect(screen.queryByRole('listbox')).toBeNull();
});
it('supports typeahead and an actual form value without native dropdown chrome', () => {
  const change = vi.fn(); render(<form aria-label="Activity"><label>Type<SmoothSelect name="kind" defaultValue="MATCH" onChange={change}><option value="MATCH">Match</option><option value="TRAINING">Training</option></SmoothSelect></label></form>);
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 't' }); expect(change).toHaveBeenCalled(); expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('kind')).toBe('TRAINING');
});
it('family plans is a nonmodal closable window with a keyboard move handle', () => {
  const close = vi.fn(); render(<FamilyPlanWindow open onClose={close}/>);
  expect(screen.getByRole('dialog', { name: 'Family plans window' })).toHaveAttribute('aria-modal', 'false'); expect(screen.getByRole('button', { name: 'Move family plans window' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Close family plans' })); expect(close).toHaveBeenCalledOnce();
});
