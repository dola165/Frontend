import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidedFlow, type GuideResult, type GuideTask } from './GuidedFlow';
import { QuickAnswer } from './QuickAnswer';
import { runGuideTask } from './taskBridge';
import type { PageView } from '../api';

vi.mock('./copy', () => ({ useGuideCopy: () => (text: string) => text }));
const overlay = vi.hoisted(() => ({ obscured: false }));
vi.mock('./useGuidePlacement', () => ({ useGuidePlacement: () => ({ host: document.body, inline: false, left: 12, top: 12, maxHeight: 800, obscured: overlay.obscured }) }));
const saves = vi.hoisted(() => ({ saveIdentity: vi.fn(), saveBox: vi.fn() }));
vi.mock('../edit/context', () => ({ usePageEdit: () => saves }));
const page = { identity: { name: 'Academy', about: 'Football in Tbilisi', contact: { phone: '', email: '' } }, boxes: { fees: { band: null } }, suggestions: null } as unknown as PageView;
const complete = (): GuideResult => ({ status: 'complete' });
const second: GuideTask = { id: 'second', title: 'Second task', next: complete };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); overlay.obscured = false; });

describe('GuidedFlow', () => {
  it('commits a refresh batched with save completion before choosing the next task', async () => {
    const finished = vi.fn();
    function Adapter() {
      const [saved, setSaved] = useState(false);
      const first = { id: 'training', title: 'Plan training', next: async () => { await Promise.resolve(); setSaved(true); return complete(); } };
      return <GuidedFlow flowId="batched-refresh" title="My squads" tasks={saved ? [first, second] : [first]} onFinish={finished} />;
    }
    render(<Adapter />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Next' })); });
    expect(screen.getByText('Second task')).toBeVisible();
    expect(finished).not.toHaveBeenCalled();
  });
  it('continues to a follow-up task added by the successful save refresh', async () => {
    let resolve!: (result: GuideResult) => void;
    const first = { id: 'training', title: 'Plan training', next: () => new Promise<GuideResult>(done => { resolve = done; }) };
    const finished = vi.fn();
    const { rerender } = render(<GuidedFlow flowId="refresh" title="My squads" tasks={[first]} onFinish={finished} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    rerender(<GuidedFlow flowId="refresh" title="My squads" tasks={[first, second]} onFinish={finished} />);
    await act(async () => resolve(complete()));
    expect(screen.getByText('Second task')).toBeVisible();
    expect(finished).not.toHaveBeenCalled();
  });
  it('keeps the active task and draft by ID when refresh removes an earlier task', () => {
    const first = { id: 'responsibility', title: 'Ask for access', next: complete };
    const active = { ...second, content: <input aria-label="Task title" /> };
    const last = { id: 'attendance', title: 'Record attendance', next: complete };
    const { rerender } = render(<GuidedFlow flowId="identity" title="Club" tasks={[first, active, last]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Bring the kit' } });
    rerender(<GuidedFlow flowId="identity" title="Club" tasks={[active, last]} />);
    expect(screen.getByText('Second task')).toBeVisible();
    expect(screen.getByLabelText('Task title')).toHaveValue('Bring the kit');
  });
  it('keeps an unsubmitted draft while another page temporarily suspends the guide', () => {
    const tasks = [{ id: 'first', title: 'First task', content: <input aria-label="Draft" />, next: complete }];
    const { rerender } = render(<GuidedFlow flowId="suspended" title="Club" tasks={tasks} />);
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Still working' } });
    rerender(<GuidedFlow flowId="suspended" title="Club" tasks={tasks} suspended />);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    rerender(<GuidedFlow flowId="suspended" title="Club" tasks={tasks} />);
    expect(screen.getByLabelText('Draft')).toHaveValue('Still working');
  });
  it('cancels delayed guide focus when an unrelated modal opens', () => {
    vi.useFakeTimers();
    try {
      const tasks = [{ id: 'first', title: 'First task', content: <input aria-label="Guide answer" />, next: complete }];
      const view = <><input aria-label="Account name" /><GuidedFlow flowId="focus" title="Club" tasks={tasks} /></>;
      const { rerender } = render(view);
      screen.getByLabelText('Account name').focus();
      overlay.obscured = true;
      rerender(<><input aria-label="Account name" /><GuidedFlow flowId="focus" title="Club" tasks={tasks} /></>);
      act(() => { vi.advanceTimersByTime(100); });
      expect(screen.getByLabelText('Account name')).toHaveFocus();
    } finally { vi.useRealTimers(); }
  });
  it('submits the latest controlled value immediately after the last change', async () => {
    const save = vi.fn<(value: string) => GuideResult>(complete);
    function Adapter() {
      const [value, setValue] = useState('Old title');
      return <GuidedFlow flowId="latest" title="Club" tasks={[{ id: 'first', title: 'Staff task', content: <input aria-label="Title" value={value} onChange={e => setValue(e.target.value)} />, next: () => save(value) }, second]} />;
    }
    render(<Adapter />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bring the kit now' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Second task');
    expect(save).toHaveBeenCalledWith('Bring the kit now');
  });
  it('can skip a single optional task without saving or reporting completion', () => {
    const next = vi.fn(complete), finished = vi.fn();
    render(<GuidedFlow flowId="optional" title="Club" tasks={[{ id: 'only', title: 'Optional task', next }]} onFinish={finished} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByRole('button', { name: 'Show Dola' })).toBeInTheDocument();
    expect(next).not.toHaveBeenCalled(); expect(finished).not.toHaveBeenCalled();
  });
  it('keeps an unsubmitted answer when hidden and shown again', () => {
    render(<GuidedFlow flowId="hide" title="Club" tasks={[{ id: 'first', title: 'First task', content: <input aria-label="Answer" />, next: complete }]} />);
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'Still typing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hide Dola' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Dola' }));
    expect(screen.getByLabelText('Answer')).toHaveValue('Still typing');
  });
  it('waits for acknowledged success, prevents duplicate saves and disables leaving while saving', async () => {
    let resolve!: (result: GuideResult) => void;
    const next = vi.fn(() => new Promise<GuideResult>(done => { resolve = done; }));
    render(<GuidedFlow flowId="user:1:club:2" title="Club" tasks={[{ id: 'first', title: 'First task', next }, second]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(next).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled();
    expect(screen.queryByText('Second task')).not.toBeInTheDocument();
    await act(async () => resolve({ status: 'complete' }));
    expect(screen.getByText('Second task')).toBeInTheDocument();
  });
  it('keeps the answer and step after a rejected save, and retries the same action', async () => {
    const next = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ status: 'complete' });
    render(<GuidedFlow flowId="retry" title="Club" tasks={[{ id: 'first', title: 'First task', content: <input aria-label="Answer" defaultValue="" />, next }, second]} />);
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'My answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved');
    expect(screen.getByLabelText('Answer')).toHaveValue('My answer');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Second task');
    expect(next).toHaveBeenCalledTimes(2);
  });
  it('does not treat an intermediate confirmation or popup dismissal as completion', async () => {
    const task = { id: 'first', title: 'First task', next: vi.fn((): GuideResult => ({ status: 'stay', message: 'Choose a pin' })) };
    const { rerender } = render(<GuidedFlow flowId="dismiss" title="Club" tasks={[task, second]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Choose a pin');
    rerender(<GuidedFlow flowId="dismiss" title="Club" tasks={[{ ...task, content: <p>Editor closed</p> }, second]} />);
    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.queryByText('Second task')).not.toBeInTheDocument();
  });
  it('keeps the furthest step after Back and reload; an earlier skipped task does not pull it back', () => {
    const tasks = [{ id: 'first', title: 'First task', next: complete }, second];
    const { unmount } = render(<GuidedFlow flowId="progress" title="Club" tasks={tasks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('First task')).toBeInTheDocument();
    unmount();
    render(<GuidedFlow flowId="progress" title="Club" tasks={tasks} />);
    expect(screen.getByText('Second task')).toBeInTheDocument();
  });
  it('ignores an old account’s delayed result after flow identity changes', async () => {
    let resolve!: (result: GuideResult) => void;
    const tasks = [{ id: 'first', title: 'First task', next: () => new Promise<GuideResult>(done => { resolve = done; }) }, second];
    const { rerender } = render(<GuidedFlow flowId="account1:club1" title="Club" tasks={tasks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    rerender(<GuidedFlow flowId="account2:club2" title="Club" tasks={tasks} />);
    await act(async () => resolve({ status: 'complete' }));
    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });
  it('enters each task once without reopening on ordinary form rerenders', async () => {
    const enter = vi.fn();
    const tasks = [{ id: 'first', title: 'First task', enter, next: complete }, second];
    const { rerender } = render(<GuidedFlow flowId="entry" title="Club" tasks={tasks} />);
    rerender(<GuidedFlow flowId="entry" title="Club" tasks={[{ ...tasks[0], content: <p>Updated</p> }, second]} />);
    expect(enter).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Second task');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(enter).toHaveBeenCalledTimes(2);
  });
});

describe('Club quick answers', () => {
  it('explicitly keeps the suggested About text', async () => {
    saves.saveIdentity.mockResolvedValue(true);
    render(<GuidedFlow flowId="about" title="Club" tasks={[{ id: 'about', title: 'About club', content: <QuickAnswer step="about" page={page} />, next: () => runGuideTask('quick:about') }, second]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Second task');
    expect(saves.saveIdentity).toHaveBeenCalledWith({ about: page.identity.about, aboutAuto: false });
  });
  it('validates a blank answer, then stays on a provider false result and advances only on true', async () => {
    saves.saveIdentity.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<GuidedFlow flowId="quick" title="Club" tasks={[{ id: 'contact', title: 'Contact', content: <QuickAnswer step="contact" page={page} />, next: () => runGuideTask('quick:contact') }, second]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Enter a phone number.');
    expect(saves.saveIdentity).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+995555123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not saved'));
    expect(screen.getByLabelText('Phone')).toHaveValue('+995555123456');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Second task');
    expect(saves.saveIdentity).toHaveBeenCalledTimes(2);
  });
  it('does not turn blank or reversed fees into an implicit free offer', async () => {
    saves.saveBox.mockResolvedValue(true);
    render(<GuidedFlow flowId="fees" title="Club" tasks={[{ id: 'fees', title: 'Fees', content: <QuickAnswer step="fees" page={page} />, next: () => runGuideTask('quick:fees') }, second]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Enter a valid fee range, or choose Free.');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    expect(saves.saveBox).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Free'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Second task');
    expect(saves.saveBox).toHaveBeenCalledWith('fees', { band: { min: 0, max: 0, currency: 'GEL', period: 'MONTH', free: 'ALL' } });
  });
});
