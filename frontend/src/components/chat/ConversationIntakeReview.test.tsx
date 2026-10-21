import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConversationIntakeContext } from './ConversationIntakeContext';
const api = vi.hoisted(() => ({ fetchConversationEnquiries: vi.fn() }));
vi.mock('../../features/joining-contract/api', () => api);
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({
  sessionId: null,
  user: { id: 7, navigationCapabilities: { version: 1, workspaces: [
    { id: 'club.operations', context: { type: 'club', id: 1, label: 'Dinamo' } },
  ] } },
}) }));

it('keeps a parent at their own routed case when their staff appointment covers a different group', async () => {
  localStorage.clear();
  api.fetchConversationEnquiries.mockResolvedValue([{
    id: 81, conversationId: 80, playerName: 'Synthetic child', organizationName: 'Dinamo',
    caseId: 91, status: 'ROUTED', actions: [],
    staffDestination: '/clubs/1/workspace?tab=admissions&caseId=91',
    applicantDestination: '/admissions/cases/91',
  }]);
  render(<MemoryRouter><ConversationIntakeContext conversationId={80}/></MemoryRouter>);
  expect(await screen.findByRole('link')).toHaveAttribute('href', '/admissions/cases/91');
});
