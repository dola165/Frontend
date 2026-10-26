import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Copy, Trash2 } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepsNativeMenu, LONG_PRESS_MS, placeMenu, type ContextMenuItems } from '../contextMenuParts';
import { useContextMenu } from '../useContextMenu';

function Row({ items, label = 'Message', disabled = false }: { items: () => ContextMenuItems; label?: string; disabled?: boolean }) {
    const menu = useContextMenu(items, { label, disabled });
    return <>
        <button type="button" {...menu.bind}>A message <a href="/elsewhere">a link</a></button>
        <input aria-label="Box" {...menu.bind} />
        {menu.menu}
    </>;
}

const standard = (spy = { copy: vi.fn(), remove: vi.fn(), edit: vi.fn() }): ContextMenuItems => [
    { key: 'copy', label: 'Copy text', icon: Copy, onSelect: spy.copy },
    { key: 'edit', label: 'Edit', disabled: true, reason: 'Only the person who wrote it', onSelect: spy.edit },
    false,
    { key: 'delete', label: 'Delete for everyone', icon: Trash2, danger: true, separated: true, onSelect: spy.remove },
];

afterEach(() => { vi.useRealTimers(); });

describe('placeMenu', () => {
    const screenSize = { width: 400, height: 300 };
    it('opens right and down from the pointer when there is room', () => {
        expect(placeMenu({ x: 20, y: 30 }, { width: 200, height: 100 }, screenSize)).toEqual({ x: 20, y: 30, maxHeight: 284 });
    });
    it('opens to the left and above when the pointer is near the far edges', () => {
        expect(placeMenu({ x: 390, y: 290 }, { width: 200, height: 100 }, screenSize)).toEqual({ x: 190, y: 190, maxHeight: 284 });
    });
    it('never leaves the screen, and a menu taller than it scrolls', () => {
        const place = placeMenu({ x: 150, y: 150 }, { width: 380, height: 900 }, screenSize);
        expect(place).toEqual({ x: 8, y: 8, maxHeight: 284 });
        expect(placeMenu({ x: 5, y: 5 }, { width: 500, height: 50 }, screenSize).x).toBe(8);
    });
});

describe('keepsNativeMenu', () => {
    it('keeps the browser menu in text boxes, on links inside, and over selected text', () => {
        document.body.innerHTML = '<div id="row"><p id="text">Hello there</p><a id="link" href="/x">x</a><textarea id="box"></textarea></div>';
        const row = document.getElementById('row') as HTMLElement;
        expect(keepsNativeMenu(document.getElementById('box'), row)).toBe(true);
        expect(keepsNativeMenu(document.getElementById('link'), row)).toBe(true);
        expect(keepsNativeMenu(document.getElementById('text'), row)).toBe(false);
        const range = document.createRange();
        range.selectNodeContents(document.getElementById('text') as HTMLElement);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        expect(keepsNativeMenu(document.getElementById('text'), row)).toBe(true);
        window.getSelection()?.removeAllRanges();
        document.body.innerHTML = '';
    });
});

describe('useContextMenu', () => {
    it('opens at the pointer on a right click, with icons, a danger item and a disabled one that says why', async () => {
        render(<Row items={() => standard()} />);
        const row = screen.getByRole('button', { name: /A message/ });
        const event = fireEvent.contextMenu(row, { clientX: 40, clientY: 60 });
        expect(event).toBe(false); // the browser's own menu is not shown
        const menu = await screen.findByRole('menu', { name: 'Message' });
        expect(menu.style.left).toBe('40px');
        expect(menu.style.top).toBe('60px');
        const items = screen.getAllByRole('menuitem');
        expect(items.map(item => item.textContent)).toEqual(['Copy text', 'EditOnly the person who wrote it', 'Delete for everyone']);
        expect(items[1]).toHaveAccessibleName('Edit');
        expect(items[1]).toHaveAttribute('aria-disabled', 'true');
        expect(items[1]).toHaveAccessibleDescription('Only the person who wrote it');
        expect(items[2]).toHaveAttribute('data-danger');
        expect(screen.getByRole('separator')).toBeInTheDocument();
        expect(items[0]).toHaveFocus();
    });

    it('moves with the arrow keys, Home, End and a letter; Escape closes it and focus goes back', async () => {
        const user = userEvent.setup();
        render(<Row items={() => standard()} />);
        const row = screen.getByRole('button', { name: /A message/ });
        row.focus();
        fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
        const items = await screen.findAllByRole('menuitem');
        await user.keyboard('{ArrowDown}');
        expect(items[1]).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(items[2]).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(items[0]).toHaveFocus();
        await user.keyboard('{ArrowUp}');
        expect(items[2]).toHaveFocus();
        await user.keyboard('{Home}');
        expect(items[0]).toHaveFocus();
        await user.keyboard('{End}');
        expect(items[2]).toHaveFocus();
        await user.keyboard('e');
        expect(items[1]).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(row).toHaveFocus();
    });

    it('opens from the keyboard with Shift+F10 or the menu key, at the element', async () => {
        const user = userEvent.setup();
        render(<Row items={() => standard()} />);
        const row = screen.getByRole('button', { name: /A message/ });
        row.getBoundingClientRect = () => ({ left: 100, top: 50, bottom: 80, right: 300, width: 200, height: 30, x: 100, y: 50, toJSON: () => ({}) });
        row.focus();
        await user.keyboard('{Shift>}{F10}{/Shift}');
        const menu = await screen.findByRole('menu');
        expect(menu.style.left).toBe('124px');
        expect(menu.style.top).toBe('80px');
        // The context menu event the key sends after it does not open a second one, nor the browser's.
        expect(fireEvent.contextMenu(row)).toBe(false);
        expect(screen.getAllByRole('menu')).toHaveLength(1);
        await user.keyboard('{Escape}');
        expect(row).toHaveFocus();
        fireEvent.keyDown(row, { key: 'ContextMenu' });
        expect(await screen.findByRole('menu')).toBeInTheDocument();
    });

    it('does what was chosen once it has closed, and does nothing for a disabled item', async () => {
        const user = userEvent.setup();
        const spy = { copy: vi.fn(), remove: vi.fn(), edit: vi.fn() };
        render(<Row items={() => standard(spy)} />);
        fireEvent.contextMenu(screen.getByRole('button', { name: /A message/ }), { clientX: 10, clientY: 10 });
        await user.click(await screen.findByRole('menuitem', { name: /^Edit/ }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(spy.edit).not.toHaveBeenCalled();
        await user.click(screen.getByRole('menuitem', { name: 'Delete for everyone' }));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 5)); });
        expect(spy.remove).toHaveBeenCalledTimes(1);
    });

    it('closes on a click elsewhere, and only one menu is open at a time', async () => {
        function Two() {
            const a = useContextMenu(() => [{ key: 'a', label: 'First', onSelect: () => undefined }], { label: 'A' });
            const b = useContextMenu(() => [{ key: 'b', label: 'Second', onSelect: () => undefined }], { label: 'B' });
            return <><button type="button" {...a.bind}>one</button><button type="button" {...b.bind}>two</button><p>outside</p>{a.menu}{b.menu}</>;
        }
        render(<Two />);
        fireEvent.contextMenu(screen.getByRole('button', { name: 'one' }), { clientX: 1, clientY: 1 });
        expect(await screen.findByRole('menu', { name: 'A' })).toBeInTheDocument();
        fireEvent.contextMenu(screen.getByRole('button', { name: 'two' }), { clientX: 1, clientY: 1 });
        expect(await screen.findByRole('menu', { name: 'B' })).toBeInTheDocument();
        expect(screen.queryByRole('menu', { name: 'A' })).not.toBeInTheDocument();
        fireEvent.pointerDown(screen.getByText('outside'));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('leaves the browser menu alone in text boxes and on links, and opens nothing with no items', () => {
        render(<Row items={() => [false, null]} />);
        expect(fireEvent.contextMenu(screen.getByRole('textbox', { name: 'Box' }))).toBe(true);
        expect(fireEvent.contextMenu(screen.getByRole('link', { name: 'a link' }))).toBe(true);
        expect(fireEvent.contextMenu(screen.getByRole('button', { name: /A message/ }))).toBe(true);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('opens on a held finger, not on a finger that scrolls, and the lifting finger is no tap', () => {
        vi.useFakeTimers();
        const tapped = vi.fn();
        function Held() {
            const menu = useContextMenu(() => standard(), { label: 'Message' });
            return <><button type="button" onClick={tapped} {...menu.bind}>Hold me</button>{menu.menu}</>;
        }
        render(<Held />);
        const row = screen.getByRole('button', { name: 'Hold me' });
        // Moving more than a few pixels is scrolling.
        fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 20, clientY: 20 });
        fireEvent.pointerMove(row, { pointerType: 'touch', clientX: 20, clientY: 60 });
        act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 50); });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        // A quick tap is a tap.
        fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 20, clientY: 20 });
        fireEvent.pointerUp(row, { pointerType: 'touch' });
        fireEvent.click(row);
        expect(tapped).toHaveBeenCalledTimes(1);
        act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 50); });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        // Held still: the menu, at the finger; lifting it is not a tap; Android's own context menu event changes nothing.
        fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 30, clientY: 40 });
        act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 10); });
        const menu = screen.getByRole('menu');
        expect(menu.style.left).toBe('30px');
        expect(fireEvent.contextMenu(row, { clientX: 30, clientY: 40 })).toBe(false);
        fireEvent.pointerUp(row, { pointerType: 'touch' });
        fireEvent.click(row);
        expect(tapped).toHaveBeenCalledTimes(1);
        expect(screen.getAllByRole('menu')).toHaveLength(1);
    });

    it('a held finger on a menu inside another opens only the inner one', () => {
        vi.useFakeTimers();
        function Nested() {
            const outer = useContextMenu(() => [{ key: 'start', label: 'Start a chat', onSelect: () => undefined }], { label: 'Column' });
            const inner = useContextMenu(() => [{ key: 'open', label: 'Open', onSelect: () => undefined }], { label: 'Chat' });
            return <nav {...outer.bind}><button type="button" {...inner.bind}>A chat</button>{outer.menu}{inner.menu}</nav>;
        }
        render(<Nested />);
        fireEvent.pointerDown(screen.getByRole('button', { name: 'A chat' }), { pointerType: 'touch', clientX: 5, clientY: 5 });
        act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 20); });
        expect(screen.getAllByRole('menu')).toHaveLength(1);
        expect(screen.getByRole('menu', { name: 'Chat' })).toBeInTheDocument();
    });

    it('stays inside the screen, measured where it opens', async () => {
        const original = HTMLElement.prototype.getBoundingClientRect;
        HTMLElement.prototype.getBoundingClientRect = function () {
            return this.getAttribute('role') === 'menu'
                ? { left: 0, top: 0, right: 220, bottom: 150, width: 220, height: 150, x: 0, y: 0, toJSON: () => ({}) }
                : original.call(this);
        };
        try {
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
            Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });
            render(<Row items={() => standard()} />);
            fireEvent.contextMenu(screen.getByRole('button', { name: /A message/ }), { clientX: 380, clientY: 690 });
            const menu = await screen.findByRole('menu');
            expect(menu.style.left).toBe('160px');
            expect(menu.style.top).toBe('540px');
        } finally {
            HTMLElement.prototype.getBoundingClientRect = original;
        }
    });

    it('can be switched off, and then the browser menu stays', () => {
        render(<Row items={() => standard()} disabled />);
        expect(fireEvent.contextMenu(screen.getByRole('button', { name: /A message/ }))).toBe(true);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
