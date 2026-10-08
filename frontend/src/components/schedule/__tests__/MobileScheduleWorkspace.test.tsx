import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import { MobileScheduleWorkspace } from '../MobileScheduleWorkspace';
import { EVENT_TYPES, type ScheduleWorkspaceEvent } from '../workspaceTypes';

const event: ScheduleWorkspaceEvent = {
    id: 'training-1', eventId: 1, title: 'Evening training with the first team', eventType: 'TRAINING',
    startsAt: '2099-01-05T18:00:00', endsAt: '2099-01-05T19:30:00', locationText: 'Training pitch, south entrance',
    status: 'Scheduled', visibility: 'CLUB_ONLY', publicationState: 'PRIVATE', recurring: false,
    ownerLabel: 'City club', mapEligible: false, appearsOnMap: false, conflictingEventIds: [],
};
type Props = ComponentProps<typeof MobileScheduleWorkspace>;
const props: Props = {
    surface: 'CLUB_SCHEDULE', clubName: 'City club', canOpenClub: true, canCreate: true,
    view: 'week', date: new Date('2099-01-05T12:00:00'), rangeLabel: '5–11 January 2099', events: [event],
    routines: [], eventTypes: EVENT_TYPES, publicOnly: false, busy: false, notices: [],
    onSurface: vi.fn(), onView: vi.fn(), onDate: vi.fn(), onPrevious: vi.fn(), onNext: vi.fn(), onToday: vi.fn(),
    onCreate: vi.fn(), onOpenEvent: vi.fn(), onToggleType: vi.fn(), onPublicOnly: vi.fn(), onResetFilters: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

it('shows complete event information and opens the selected event without desktop drag controls', async () => {
    const user = userEvent.setup();
    render(<MobileScheduleWorkspace {...props} />);
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: /Evening training/ });
    expect(card).toHaveTextContent('18:00 – 19:30');
    expect(card).toHaveTextContent(event.locationText!);
    await user.click(card);
    expect(props.onOpenEvent).toHaveBeenCalledWith(event);
});

it('opens filters only on demand, changes types using the whole row and restores focus on dismissal', async () => {
    const user = userEvent.setup();
    function Harness() {
        const [types, setTypes] = useState(EVENT_TYPES);
        return <MobileScheduleWorkspace {...props} eventTypes={types} onToggleType={type => setTypes(current => current.filter(value => value !== type))} />;
    }
    render(<Harness />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Filters' });
    await user.click(button);
    const sheet = screen.getByRole('dialog', { name: 'Filters & routines' });
    await user.click(within(sheet).getByText('Training', { exact: true }));
    expect(within(sheet).getByRole('checkbox', { name: 'Training' })).not.toBeChecked();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters, active' })).toHaveFocus();
});

it('keeps personal planning available without offering club access to users without a club', () => {
    render(<MobileScheduleWorkspace {...props} surface="MY_SCHEDULE" canOpenClub={false} />);
    expect(screen.getByRole('button', { name: 'New event' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Club schedule' })).not.toBeInTheDocument();
});

it('lets club members view events without advertising create/edit actions', async () => {
    const user = userEvent.setup();
    render(<MobileScheduleWorkspace {...props} canCreate={false} />);
    expect(screen.queryByRole('button', { name: 'New event' })).not.toBeInTheDocument();
    expect(screen.queryByText('View or edit event')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Evening training/ }));
    expect(props.onOpenEvent).toHaveBeenCalledWith(event);
});

it('supports date jumps and day/month ranges without a sideways calendar', async () => {
    const user = userEvent.setup();
    render(<MobileScheduleWorkspace {...props} />);
    fireEvent.change(screen.getByLabelText('Jump to date'), { target: { value: '2099-02-10' } });
    expect(props.onDate).toHaveBeenCalledWith(new Date('2099-02-10T12:00:00'));
    await user.click(screen.getByRole('button', { name: 'Day' }));
    expect(props.onView).toHaveBeenCalledWith('day');
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(props.onView).toHaveBeenCalledWith('month');
});

it('offers filter recovery from an empty agenda', async () => {
    const user = userEvent.setup();
    render(<MobileScheduleWorkspace {...props} events={[]} eventTypes={[]} />);
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    await waitFor(() => expect(props.onResetFilters).toHaveBeenCalledOnce());
});
