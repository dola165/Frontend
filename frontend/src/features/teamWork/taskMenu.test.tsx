import '../../i18n';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as work from './api';
import * as chat from '../teamChat/api';
import { TaskMenuProvider } from './TaskMenuProvider';
import { TaskRow } from './TaskRow';
import type { Pins } from './usePins';

vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof work>(), changeWork: vi.fn() }));
vi.mock('../teamChat/api', async importOriginal => ({ ...await importOriginal<typeof chat>(), createChat: vi.fn() }));

const task = (extra: Partial<work.WorkItem> = {}) => ({
    id: 30, key: 'GK-30', title: 'Map markers', status: 'IN_PROGRESS', people: [], parentId: null, updatedAt: new Date().toISOString(), updatedBy: null,
    openQuestions: 0, version: 4, doneMeans: null, chatId: null, chatMessages: 0, ...extra,
}) as unknown as work.WorkItem;

function Where() { const location = useLocation(); return <output data-testid="where">{location.pathname}{location.search}</output>; }
const pins = (pinned: boolean): Pins => ({ pins: [], pinned: () => pinned, toggle: vi.fn(async () => undefined), error: '', full: false });

beforeEach(() => { vi.resetAllMocks(); });

function mount(item: work.WorkItem, support: { pins?: Pins; onChanged?: () => void } = {}) {
    const onOpen = vi.fn();
    render(<MemoryRouter initialEntries={['/team-work']}><Routes>
        <Route path="*" element={<TaskMenuProvider {...support}><ul><TaskRow item={item} onOpen={onOpen} /></ul><Where /></TaskMenuProvider>} />
    </Routes></MemoryRouter>);
    return { onOpen, row: document.querySelector('.tw-row__open') as HTMLElement };
}

it('right-click a task to open it, discuss it, move it, copy it or pin it', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    vi.mocked(work.changeWork).mockResolvedValue({} as work.Detail);
    vi.mocked(chat.createChat).mockResolvedValue({ id: 77 } as chat.ChatSummary);
    const onChanged = vi.fn();
    const pinning = pins(false);
    const { onOpen, row } = mount(task(), { pins: pinning, onChanged });

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    const menu = screen.getByRole('menu', { name: 'GK-30 Map markers' });
    expect(within(menu).getAllByRole('menuitem').map(item => item.getAttribute('data-label'))).toEqual([
        'Open', 'Discuss in a chat', 'Move to Planned', 'Move to In progress', 'Move to Needs your look', 'Move to Blocked',
        'Copy GK-30', 'Copy link', 'Copy key and name', 'Pin to your Overview',
    ]);
    expect(within(menu).getByRole('menuitem', { name: 'Move to In progress' })).toHaveAccessibleDescription('It is there now.');
    await user.click(within(menu).getByRole('menuitem', { name: 'Move to Blocked' }));
    await waitFor(() => expect(work.changeWork).toHaveBeenCalledWith(30, { version: 4, status: 'BLOCKED' }));
    expect(onChanged).toHaveBeenCalled();

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole('menuitem', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/team-work?task=30`));
    expect(await screen.findByText('Link copied')).toHaveAttribute('role', 'status');

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole('menuitem', { name: 'Pin to your Overview' }));
    await waitFor(() => expect(pinning.toggle).toHaveBeenCalledWith({ itemId: 30 }));

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole('menuitem', { name: 'Open' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(30, null));

    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole('menuitem', { name: 'Discuss in a chat' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/team-work/chat?chat=77'));
    expect(chat.createChat).toHaveBeenCalledWith({ taskId: 30 });
});

it('says why a task menu cannot do something here', () => {
    const { row } = mount(task({ chatPrivate: true }));
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    expect(screen.getByRole('menuitem', { name: 'Discuss in a chat' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Pin to your Overview' })).toHaveAccessibleDescription('Pins are on Team work’s Overview.');
});
