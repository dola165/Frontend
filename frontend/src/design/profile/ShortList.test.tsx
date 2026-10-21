import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShowAllRow } from './ShortList';
import { useShortList } from './useShortList';

function Names({ names }: { names: string[] }) {
    const list = useShortList(names);
    return <div className="gk"><ul>{list.shown.map(name => <li key={name}>{name}</li>)}<ShowAllRow more={list.more} showAll={`Show all ${names.length}`} showFewer="Show fewer" /></ul></div>;
}

it('shows five rows, opens the rest in place and folds back', async () => {
    const names = Array.from({ length: 12 }, (_, i) => `Squad ${i + 1}`);
    render(<Names names={names} />);
    expect(screen.queryByText('Squad 6')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all 12' }));
    expect(screen.getByText('Squad 12')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
});

it('adds no switch to a short list', () => {
    render(<Names names={['U12', 'U14']} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
