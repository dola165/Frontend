import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrialistBadge } from '../TrialistBadge';

describe('TrialistBadge', () => {
    it('stays stable when trialist eligibility appears after the first render', () => {
        const { rerender } = render(<TrialistBadge joinedAt={null} onApprove={vi.fn()} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();

        rerender(<TrialistBadge joinedAt={new Date().toISOString()} onApprove={vi.fn()} />);
        expect(screen.getByRole('button', { name: /days as trialist/i })).toBeInTheDocument();
    });

    it('supports menu focus, arrow navigation, Escape return and narrow widths', async () => {
        const user = userEvent.setup();
        render(<TrialistBadge joinedAt={new Date().toISOString()} onApprove={vi.fn()} onRelease={vi.fn()} />);
        const trigger = screen.getByRole('button', { name: /days as trialist/i });

        await user.click(trigger);
        const menu = screen.getByRole('menu', { name: 'Trialist actions' });
        const items = screen.getAllByRole('menuitem');
        await waitFor(() => expect(items[0]).toHaveFocus());
        expect(menu).toHaveClass('max-w-[calc(100vw-2rem)]');

        await user.keyboard('{ArrowDown}');
        expect(items[1]).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
