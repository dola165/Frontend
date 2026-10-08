import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productSurface, useProductDesign } from '../productDesign';

afterEach(() => { vi.useRealTimers(); });
function Surface({ path }: { path: string }) {
    useProductDesign(path);
    const [draft, setDraft] = useState('');
    return <input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} />;
}
describe('product presentation boundary', () => {
    it.each(['/home', '/home/', '/feed', '/clubs/1', '/clubs/27/', '/organizations/123'])('preserves the approved surface %s', path => {
        expect(productSurface(path)).toBeUndefined();
        render(<Surface path={path} />);
        expect(document.documentElement).not.toHaveClass('product-design-active');
    });
    it.each(['/login', '/world', '/map', '/clubs', '/clubs/1/workspace', '/clubs/1/store', '/organizations/123/workspace', '/store/products/1', '/profile/1', '/account', '/unknown'])('styles remaining routes and their body portals: %s', path => {
        render(<Surface path={path} />);
        expect(document.documentElement).toHaveClass('product-design-active');
    });
    it('updates text immediately and cleans brief feedback without changing draft or focus', () => {
        vi.useFakeTimers();
        const view = render(<Surface path="/requests" />);
        const input = screen.getByRole('textbox'); input.focus();
        fireEvent.input(input, { target: { value: 'Training — თბილისი' } });
        expect(input).toHaveValue('Training — თბილისი');
        expect(input).toHaveFocus(); expect(input).toHaveAttribute('data-input-active', 'true');
        vi.advanceTimersByTime(160);
        expect(input).not.toHaveAttribute('data-input-active'); expect(input).toHaveFocus();
        view.rerender(<Surface path="/home" />);
        expect(input).toHaveValue('Training — თბილისი');
        expect(document.documentElement).not.toHaveClass('product-design-active');
        fireEvent.input(input, { target: { value: 'Still immediate' } });
        expect(input).not.toHaveAttribute('data-input-active');
    });
    it('leaves IME composition alone and removes pending feedback on navigation', () => {
        vi.useFakeTimers(); const view = render(<Surface path="/account" />);
        const input = screen.getByRole('textbox'); input.focus();
        fireEvent.compositionStart(input); fireEvent.input(input, { target: { value: 'ქ' } });
        expect(input).toHaveValue('ქ'); expect(input).not.toHaveAttribute('data-input-active');
        fireEvent.compositionEnd(input); fireEvent.input(input, { target: { value: 'ქართული' } });
        expect(input).toHaveAttribute('data-input-active', 'true');
        view.rerender(<Surface path="/organizations/123" />);
        expect(input).not.toHaveAttribute('data-input-active');
        expect(document.documentElement).not.toHaveClass('product-design-active');
        vi.advanceTimersByTime(160);
        expect(input).not.toHaveAttribute('data-input-active');
        expect(input).toHaveValue('ქართული');
    });
});
