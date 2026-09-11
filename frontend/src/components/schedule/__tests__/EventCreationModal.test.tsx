import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventCreationModal, type EventCreationFormValues } from '../EventCreationModal';
import { apiClient } from '../../../api/axiosConfig';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));

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
    it('saves training with the selected squad and preserves the assignment on edit', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 16, name: 'U16' }, { id: 17, name: 'First team' }] });
        const user = userEvent.setup(); const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<EventCreationModal isOpen mode="edit" surface="CLUB_SCHEDULE" clubId={701} targetEventClubId={701}
            initialValues={{ ...initialValues, eventType: 'TRAINING', title: 'Evening training', hostSquadId: 16 }}
            subjectLabel="Club" onClose={vi.fn()} onSubmit={onSubmit} />);
        await screen.findByRole('option', { name: 'U16' });
        expect(screen.getByRole('combobox', { name: 'Squad' })).toHaveValue('16');
        await user.selectOptions(screen.getByRole('combobox', { name: 'Squad' }), '17');
        await user.click(screen.getByRole('button', { name: /continue/i }));
        await user.click(screen.getByRole('button', { name: /continue/i }));
        await user.click(screen.getByRole('button', { name: /save.?event/i }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'TRAINING', hostSquadId: 17 }), expect.anything()));
    });
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
