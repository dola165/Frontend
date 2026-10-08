import { render, screen } from '@testing-library/react';
import '../../i18n';
import { TryoutCancellationNotice } from './TryoutCancellationNotice';

const application = { id: 1, tryoutId: 2, tryoutTitle: 'Session', status: 'ACCEPTED', appliedAt: '2026-09-19', tryoutLifecycleStatus: 'CANCELLED', cancelledAt: '2026-09-20' };
it('presents session cancellation independently of the retained accepted decision', () => {
    render(<TryoutCancellationNotice application={application}/>);
    expect(screen.getByRole('status')).toHaveTextContent('Tryout cancelled. Your accepted decision and existing club affiliation are retained.');
});
it('does not infer session cancellation from an application outcome alone', () => {
    const { container } = render(<TryoutCancellationNotice application={{ ...application, status: 'CANCELLED', tryoutLifecycleStatus: undefined }}/>);
    expect(container).toBeEmptyDOMElement();
});
