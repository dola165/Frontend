import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactionButton } from '../ReactionButton';

it('offers seven accessible choices and replaces or removes the selected reaction', async () => {
    const user = userEvent.setup(), change = vi.fn();
    const { rerender } = render(<ReactionButton value={null} onChange={change} />);
    await user.click(screen.getByRole('button', { name: 'Choose a reaction' }));
    const picker = screen.getByRole('toolbar', { name: 'Post reactions' });
    expect(within(picker).getAllByRole('button')).toHaveLength(7);
    await user.click(within(picker).getByRole('button', { name: 'Love' }));
    expect(change).toHaveBeenLastCalledWith('LOVE');
    rerender(<ReactionButton value="LOVE" onChange={change} />);
    expect(screen.getByRole('button', { name: 'Love' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Love' }));
    expect(change).toHaveBeenLastCalledWith(null);
});

it('dismisses without saving and disables both controls while saving', async () => {
    const user = userEvent.setup(), change = vi.fn();
    const { rerender } = render(<><ReactionButton value="WOW" onChange={change} /><button>Outside</button></>);
    await user.click(screen.getByRole('button', { name: 'Choose a reaction' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wow' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Choose a reaction' }));
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
    rerender(<ReactionButton value="WOW" onChange={change} disabled />);
    expect(screen.getByRole('button', { name: 'Wow' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose a reaction' })).toBeDisabled();
});

it('lets Escape reach the enclosing dialog after closing the choices', async () => {
    const user = userEvent.setup(), dialogKey = vi.fn();
    render(<div onKeyDown={dialogKey}><ReactionButton value={null} onChange={vi.fn()} /></div>);
    await user.click(screen.getByRole('button', { name: 'Choose a reaction' }));
    await user.keyboard('{Escape}');
    expect(dialogKey).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(dialogKey).toHaveBeenCalledOnce();
});
