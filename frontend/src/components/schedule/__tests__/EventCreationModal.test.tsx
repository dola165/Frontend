import { useState, type ComponentProps } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventCreationModal, type EventCreationFormValues } from '../EventCreationModal';
import { apiClient } from '../../../api/axiosConfig';
import { cancelScheduleEvent } from '../../../features/schedule/api';
import '../../../i18n';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../../features/schedule/api', () => ({ cancelScheduleEvent: vi.fn() }));
vi.mock('../../MiniMap', () => ({ MiniMap: () => <div data-testid="mini-map" /> }));

const initialValues: EventCreationFormValues = {
    eventType: 'ACTIVITY', title: 'Evening session', date: '2099-01-07', startTime: '18:00', endTime: '19:30',
    isRecurring: false, locationName: '', locationLat: '', locationLng: '', visibility: 'PRIVATE', publishAt: '',
};
const seriesValues: EventCreationFormValues = {
    ...initialValues, eventType: 'TRAINING', title: 'U16 evening training', isRecurring: true,
    recurrenceDays: ['MONDAY', 'FRIDAY'], recurrenceStartDate: '2099-01-07', recurrenceEndDate: '',
    recurrenceStartTime: '18:00', recurrenceEndTime: '19:30', recurrenceInterval: 1, recurrenceTimezone: 'Asia/Tbilisi',
};
const renderEditor = (props: Partial<ComponentProps<typeof EventCreationModal>> = {}) => {
    const onClose = props.onClose ?? vi.fn();
    const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
    const rendered = render(<EventCreationModal isOpen mode="create" surface="MY_SCHEDULE" initialValues={initialValues}
        clubId={null} subjectLabel="My schedule" {...props} onClose={onClose} onSubmit={onSubmit} />);
    return { onClose, onSubmit, unmount: rendered.unmount };
};
const goToReview = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 16, name: 'U16' }, { id: 17, name: 'First team' }] });
    vi.mocked(cancelScheduleEvent).mockResolvedValue(undefined);
});

describe('EventCreationModal', () => {
    it('hides event attachment and volunteer extension links in production', () => {
        renderEditor({ mode: 'edit', surface: 'CLUB_SCHEDULE', clubId: 701, targetEventClubId: 701,
            canManageSchedule: true, targetEventId: 88, targetEventStartsAt: '2099-01-09T18:00:00' });
        expect(screen.queryByRole('link', { name: /Stadium reservation/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Volunteer shifts/ })).not.toBeInTheDocument();
    });

    it('preserves owning-club squads and fixture relationships while editing events', async () => {
        const user = userEvent.setup();
        const { onSubmit, unmount } = renderEditor({ mode: 'edit', surface: 'CLUB_SCHEDULE', clubId: 999, targetEventClubId: 701,
            initialValues: { ...initialValues, eventType: 'TRAINING', hostSquadId: 16 } });
        await screen.findByRole('option', { name: 'U16' });
        expect(apiClient.get).toHaveBeenCalledWith('/clubs/701/squads', expect.anything());
        expect(screen.getByRole('combobox', { name: 'Squad' })).toHaveValue('16');
        await user.selectOptions(screen.getByRole('combobox', { name: 'Squad' }), '17');
        await goToReview(user);
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'TRAINING', hostSquadId: 17, recurrence: null }), { eventType: 'TRAINING', recurring: false });
        unmount();
        const match = renderEditor({ mode: 'edit', surface: 'CLUB_SCHEDULE', clubId: 701, targetEventClubId: 701,
            initialValues: { ...initialValues, eventType: 'MATCH', hostSquadId: 17, opponentClubId: 44 } });
        await goToReview(user);
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(match.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MATCH', hostSquadId: 17, opponentClubId: 44 }), expect.anything());
    });

    it('names the dialog, focuses the event name and closes an unchanged form with Escape', async () => {
        const user = userEvent.setup();
        const { onClose } = renderEditor({ initialValues: { ...initialValues, eventType: null, title: '' } });
        expect(screen.getByRole('dialog')).toHaveAccessibleName('New event');
        await waitFor(() => expect(screen.getByRole('textbox', { name: 'Event name' })).toHaveFocus());
        await user.keyboard('{Escape}');
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('protects dirty work through Escape and the footer Cancel action', async () => {
        const user = userEvent.setup();
        const { onClose } = renderEditor();
        await user.type(screen.getByRole('textbox', { name: 'Event name' }), ' updated');
        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog')).toHaveAccessibleName('Discard Event');
        expect(onClose).not.toHaveBeenCalled();
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.getByRole('dialog')).toHaveAccessibleName('New event'));
        expect(screen.getByRole('textbox', { name: 'Event name' })).toHaveValue('Evening session updated');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        await user.click(within(screen.getByRole('dialog', { name: 'Discard Event' })).getByRole('button', { name: 'Discard' }));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('previews actual training days and saves weekly personal training as private local wall time', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderEditor({ initialValues: { ...initialValues, visibility: 'PUBLIC' } });
        await user.click(screen.getByRole('button', { name: /Weekly training/ }));
        expect(screen.queryByRole('group', { name: 'Event type' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.click(screen.getByRole('button', { name: 'Wednesday' }));
        await user.click(screen.getByRole('button', { name: 'Monday' }));
        await user.click(screen.getByRole('button', { name: 'Friday' }));
        expect(screen.getByText('First session: Fri, 9 Jan 2099')).toBeInTheDocument();
        const preview = screen.getByRole('complementary', { name: 'Schedule preview' });
        expect(within(preview).getAllByRole('listitem').map(item => item.textContent)).toEqual([
            expect.stringContaining('Fri, 9 Jan 2099'), expect.stringContaining('Mon, 12 Jan 2099'), expect.stringContaining('Fri, 16 Jan 2099'),
        ]);
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Only you can see this')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Create training schedule' }));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TRAINING', startsAt: '2099-01-07T18:00:00', endsAt: '2099-01-07T19:30:00', visibility: 'PRIVATE', publishAt: null,
            recurrence: { frequency: 'WEEKLY', intervalValue: 1, daysOfWeek: ['MONDAY', 'FRIDAY'], startDate: '2099-01-07', endDate: null,
                startTime: '18:00:00', endTime: '19:30:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        }), { eventType: 'TRAINING', recurring: true });
    });

    it('clears recurrence after switching back to a one-time event without losing the name', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderEditor();
        await user.click(screen.getByRole('button', { name: /Weekly training/ }));
        await user.click(screen.getByRole('button', { name: /One-time event/ }));
        await user.click(within(screen.getByRole('group', { name: 'Event type' })).getByRole('button', { name: 'Activity' }));
        expect(screen.getByRole('textbox', { name: 'Event name' })).toHaveValue('Evening session');
        await goToReview(user);
        await user.click(screen.getByRole('button', { name: 'Create event' }));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ACTIVITY', recurrence: null }), { eventType: 'ACTIVITY', recurring: false });
    });

    it('retains saved recurrence interval and timezone when editing a future series', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderEditor({ mode: 'edit', surface: 'CLUB_SCHEDULE', clubId: 701, targetEventClubId: 701,
            initialValues: { ...seriesValues, recurrenceInterval: 2, recurrenceTimezone: 'Pacific/Auckland' } });
        expect(screen.getByText('whole training series')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Schedule type' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Times shown in Pacific/Auckland')).toBeInTheDocument();
        expect(within(screen.getByRole('complementary', { name: 'Schedule preview' })).getByText('Fri, 23 Jan 2099')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ recurrence: expect.objectContaining({ intervalValue: 2, timezone: 'Pacific/Auckland', startDate: '2099-01-07' }) }), expect.anything());
    });

    it('blocks training windows with no sessions and invalid time ranges before review', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderEditor({ initialValues: { ...seriesValues, recurrenceDays: ['FRIDAY'], recurrenceEndDate: '2099-01-07' } });
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('alert')).toHaveTextContent('There are no training days in this date range');
        await waitFor(() => expect(screen.getByLabelText('Training end date')).toHaveFocus());
        fireEvent.change(screen.getByLabelText('Training end date'), { target: { value: '2099-01-09' } });
        fireEvent.change(screen.getByLabelText('End time'), { target: { value: '17:00' } });
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('alert')).toHaveTextContent('End time must be after start time.');
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('End time'), { target: { value: '19:00' } });
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('button', { name: 'Create training schedule' })).toBeInTheDocument();
    });

    it('validates omitted weekdays and past starts even when jumping directly to Review', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderEditor({ initialValues: { ...seriesValues, recurrenceDays: [] } });
        await user.click(screen.getByRole('button', { name: /Review & share/ }));
        expect(screen.queryByRole('button', { name: 'Create training schedule' })).not.toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Select at least one day of the week.');
        await user.click(screen.getByRole('button', { name: 'Monday' }));
        fireEvent.change(screen.getByLabelText('Training start date'), { target: { value: '2020-01-01' } });
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Event start must be in the future.');
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits only once while pending, prevents close, and preserves the form after a failed save', async () => {
        const user = userEvent.setup();
        let rejectSave!: (error: Error) => void;
        const pending = new Promise<void>((_resolve, reject) => { rejectSave = reject; });
        const onSubmit = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined);
        const { onClose } = renderEditor({ onSubmit });
        await goToReview(user);
        await user.dblClick(screen.getByRole('button', { name: 'Create event' }));
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Close event editor' }));
        expect(onClose).not.toHaveBeenCalled();
        await act(async () => { rejectSave(new Error('Temporary failure')); await pending.catch(() => undefined); });
        expect(screen.getByRole('alert')).toHaveTextContent('Could not save the event.');
        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByLabelText('Date')).toHaveValue('2099-01-07');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.click(screen.getByRole('button', { name: 'Create event' }));
        expect(onSubmit).toHaveBeenCalledTimes(2);
        expect(onSubmit.mock.calls[1][0]).toEqual(onSubmit.mock.calls[0][0]);
    });

    it('allows inspection of an already-started series without changing its boundary or cancelling its history', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderEditor({ mode: 'edit', surface: 'CLUB_SCHEDULE', clubId: 701, targetEventClubId: 701,
            canManageSchedule: true, targetEventId: 88, targetEventStartsAt: '2099-01-09T18:00:00',
            initialValues: { ...seriesValues, recurrenceStartDate: '2020-01-01' } });
        expect(screen.getByRole('status')).toHaveTextContent('This training series has already started.');
        expect(screen.getByRole('textbox', { name: 'Training name' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByLabelText('Training start date')).toHaveValue('2020-01-01');
        expect(screen.getByLabelText('Training start date')).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel series' })).not.toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('requires a publication time and keeps scheduled club visibility distinct from public', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderEditor({ surface: 'CLUB_SCHEDULE', clubId: 701 });
        await goToReview(user);
        await user.click(screen.getByText('Publish automatically later'));
        await user.click(screen.getByRole('checkbox', { name: 'Choose a publication date' }));
        await user.click(screen.getByRole('button', { name: 'Create event' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Choose a publication date.');
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Publish on'), { target: { value: '2020-01-06T09:00' } });
        await user.click(screen.getByRole('button', { name: 'Create event' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Choose a publication time in the future.');
        fireEvent.change(screen.getByLabelText('Publish on'), { target: { value: '2099-01-07T19:30' } });
        await user.click(screen.getByRole('button', { name: 'Create event' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Publish before the event ends.');
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Publish on'), { target: { value: '2099-01-06T09:00' } });
        await user.click(screen.getByRole('button', { name: 'Create event' }));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'SCHEDULED_PUBLICATION', publishAt: '2099-01-06T09:00:00' }), expect.anything());
    });

    it('confirms cancellation of the whole series before calling the owning-club endpoint', async () => {
        const user = userEvent.setup();
        const onCancelled = vi.fn();
        const { onClose } = renderEditor({ mode: 'edit', surface: 'CLUB_SCHEDULE', clubId: 999, targetEventClubId: 701,
            canManageSchedule: true, targetEventId: 88, targetEventStartsAt: '2099-01-09T18:00:00', initialValues: seriesValues, onCancelled });
        await user.click(screen.getByRole('button', { name: 'Cancel series' }));
        const confirm = screen.getByRole('dialog', { name: 'Cancel this training series?' });
        expect(confirm).toHaveTextContent('This cancels the whole training series, not just the selected session.');
        expect(cancelScheduleEvent).not.toHaveBeenCalled();
        await user.click(within(confirm).getByRole('button', { name: 'Cancel series' }));
        expect(cancelScheduleEvent).toHaveBeenCalledWith(701, 88);
        await waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('restores the surrounding calendar after confirming discard unmounts both dialogs', async () => {
        const user = userEvent.setup();
        const openFilters = vi.fn();
        const CalendarWithEditor = () => {
            const [open, setOpen] = useState(true);
            return <>
                <button type="button" onClick={openFilters}>Open calendar filters</button>
                {open && <EventCreationModal isOpen mode="create" surface="MY_SCHEDULE" initialValues={initialValues}
                    clubId={null} subjectLabel="My schedule" onClose={() => setOpen(false)} onSubmit={async () => undefined} />}
            </>;
        };
        render(<CalendarWithEditor />);
        await user.type(screen.getByRole('textbox', { name: 'Event name' }), ' changed');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        await user.click(within(screen.getByRole('dialog', { name: 'Discard Event' })).getByRole('button', { name: 'Discard' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        const filters = screen.getByRole('button', { name: 'Open calendar filters' });
        expect(filters.closest('[inert], [aria-hidden="true"]')).toBeNull();
        await user.click(filters);
        expect(openFilters).toHaveBeenCalledTimes(1);
    });
});
