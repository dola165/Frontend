import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FeedPost } from '../FeedPost';
it('offers a named post action disclosure, stable destination, and Escape focus recovery', async () => {
  const user=userEvent.setup();
  render(<MemoryRouter><FeedPost post={{id:7,authorName:'Test Coach',content:'Training',createdAt:'2026-09-28T00:00:00Z',likeCount:0,commentCount:0,isLikedByMe:false}} isCommentsOpen={false} onLikeToggle={vi.fn()} onToggleComments={vi.fn()} onSubmitComment={vi.fn()} onImageClick={vi.fn()}/></MemoryRouter>);
  const toggle=screen.getByLabelText('Actions for post by Test Coach');
  await user.click(toggle);
  const open=screen.getByRole('link',{name:'Open post'});expect(open).toHaveAttribute('href','/posts/7');
  open.focus();await user.keyboard('{Escape}');
  expect(toggle).toHaveFocus();expect(toggle.closest('details')).not.toHaveAttribute('open');
});
