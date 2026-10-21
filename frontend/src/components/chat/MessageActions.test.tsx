import { fireEvent, render, screen } from '@testing-library/react';
import { MessageActions } from './MessageActions';
vi.mock('../../features/moderation/Reporting', () => ({ ReportControl: () => <button type="button">Report message</button> }));
it('keeps reporting in an accessible actions disclosure and restores focus on Escape', () => {
  render(<MessageActions messageId={31} conversationId={9} senderId={2} />);
  expect(screen.queryByRole('button', {name: 'Report message'})).not.toBeInTheDocument();
  const trigger=screen.getByRole('button', {name: 'Message actions'}); fireEvent.click(trigger);
  expect(screen.getByRole('button', {name: 'Report message'})).toHaveFocus();
  fireEvent.keyDown(document, {key: 'Escape'}); expect(trigger).toHaveFocus(); expect(trigger).toHaveAttribute('aria-expanded','false');
});
