import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventCreationModal, type EventCreationFormValues } from '../EventCreationModal';

vi.mock('../../MiniMap', () => ({ MiniMap: () => <div data-testid="mini-map" /> }));

const initialValues: EventCreationFormValues = {
    eventType: null,
    title: '',
    date: '2099-01-01',
    startTime: '10:00',
    endTime: '11:00',
    isRecurring: false,
    locationName: '',
    locationLat: '',
    locationLng: '',
    visibility: 'PRIVATE',
    publishAt: '',
};

const renderModal = (onClose = vi.fn()) => {
    render(
        <EventCreationModal
            isOpen
            mode="create"
            surface="MY_SCHEDULE"
            initialValues={initialValues}
            clubId={null}
            subjectLabel="My schedule"
            onClose={onClose}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
        />
    );
    return onClose;
};

describe('EventCreationModal keyboard behavior', () => {
    it('exposes a named dialog, focuses the title and closes a pristine form with Escape', async () => {
        const user = userEvent.setup();
        const onClose = renderModal();
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAccessibleName();
        await waitFor(() => expect(screen.getByPlaceholderText('e.g. Senior Training')).toHaveFocus());

        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps dirty-form confirmation above the editor and Escape returns to the editor', async () => {
        const user = userEvent.setup();
        const onClose = renderModal();
        await user.click(screen.getByRole('button', { name: /training/i }));
        await user.type(screen.getByPlaceholderText('e.g. Senior Training'), 'Evening session');

        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog')).toHaveAccessibleName(/discard/i);
        expect(onClose).not.toHaveBeenCalled();

        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog')).toHaveAccessibleName(/event/i);
        expect(onClose).not.toHaveBeenCalled();
    });
});
