import { render, screen } from '@testing-library/react';
import { ScheduleDirectionWorkspace } from '../../../components/schedule/ScheduleDirectionWorkspace';
import { EVENT_TYPES } from '../../../components/schedule/workspaceTypes';

const days = Array.from({ length: 7 }, (_, index) => new Date(2026, 8, 21 + index));
const noop = () => {};
const props = {
    surface: 'CLUB_SCHEDULE' as const,
    clubName: 'Academy · U15',
    squadSchedule: true,
    canOpenClub: true,
    canCreate: false,
    mobile: false,
    busy: false,
    date: days[0],
    days,
    view: 'week' as const,
    rangeLabel: 'September 2026',
    events: [],
    squadNamesById: {},
    eventTypes: EVENT_TYPES,
    publicOnly: false,
    calendarContent: () => null,
    notices: <button type="button">Standard notice action</button>,
    onSurface: noop,
    onView: noop,
    onDate: noop,
    onPrevious: noop,
    onNext: noop,
    onToday: noop,
    onBack: noop,
    onHelp: noop,
    onCreate: noop,
    onCreateTraining: noop,
    onSelect: noop,
    onTypes: noop,
    onPublicOnly: noop,
};

it('places optional priority content before schedule controls in DOM order', () => {
    render(<ScheduleDirectionWorkspace {...props} showHeading={false} priorityContent={<button type="button">Review & reply</button>} />);
    const priority = screen.getByRole('button', { name: 'Review & reply' });
    const back = screen.getByRole('button', { name: /Academy · U15/ });
    expect(priority.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Squad schedule.' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /help/i })).toBeInTheDocument();
});

it('keeps the existing default notice position when no priority slot is supplied', () => {
    render(<ScheduleDirectionWorkspace {...props} />);
    const back = screen.getByRole('button', { name: /Academy · U15/ });
    const notice = screen.getByRole('button', { name: 'Standard notice action' });
    expect(screen.getByRole('heading', { name: 'Squad schedule.' })).toBeInTheDocument();
    expect(back.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
