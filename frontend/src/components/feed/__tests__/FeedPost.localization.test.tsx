import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../../i18n';
import { FeedPost, type FeedPostDto } from '../FeedPost';
import { EditPostDialog, ReportPostDialog, SharePostDialog } from '../PostDialogs';
import { ReactionButton } from '../ReactionButton';
import { ReactionSummary } from '../ReactionSummary';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));

const post: FeedPostDto = { id: 7, authorId: 21, authorName: 'Academy Coach', content: 'Training today', createdAt: '2026-10-17T08:00:00',
    likeCount: 0, commentCount: 2, shareCount: 2, isLikedByMe: false, isPublic: true };
const mount = (element: React.ReactNode) => render(<MemoryRouter>{element}</MemoryRouter>);
const card = (value = post, submit = vi.fn(), open = false) => <FeedPost home post={value} isCommentsOpen={open} commentsData={[]}
    onLikeToggle={vi.fn()} onReactionChange={vi.fn()} onToggleComments={vi.fn()} onSubmitComment={submit} onImageClick={vi.fn()} />;

beforeEach(async () => {
    vi.resetAllMocks();
    localStorage.clear(); localStorage.setItem('userId', '20');
    api.get.mockResolvedValue({ data: { content: [{ id: 9, name: 'Dinamo staff', contextType: 'GROUP', participants: [] }], totalElements: 1 } });
    await i18n.changeLanguage('ka');
});
afterEach(async () => { await i18n.changeLanguage('en'); });

it.each([
    { language: 'en', action: 'Comment', comments: ['0 comments', '1 comment', '2 comments'], share: 'Share', shares: ['Share', '1 share', '2 shares'] },
    { language: 'ka', action: 'კომენტარი', comments: ['0 კომენტარი', '1 კომენტარი', '2 კომენტარი'], share: 'გაზიარება', shares: ['გაზიარება', '1 გაზიარება', '2 გაზიარება'] },
])('uses complete visible and accessible comment/share count labels in $language', async ({ language, action, comments, share, shares }) => {
    await i18n.changeLanguage(language);
    mount(<>{[0, 1, 2].map(count => <div key={count}>{card({ ...post, id: 7 + count, commentCount: count, shareCount: count })}</div>)}</>);
    const articles = screen.getAllByRole('article');
    articles.forEach((article, count) => {
        expect(within(article).getByRole('button', { name: `${action}, ${comments[count]}` })).toHaveTextContent(comments[count]);
        expect(within(article).getByRole('button', { name: count === 0 ? share : `${share}, ${shares[count]}` })).toHaveTextContent(shares[count]);
    });
});

it('translates all six reaction choices and keeps the existing reaction API values', async () => {
    const user = userEvent.setup(), change = vi.fn();
    const { rerender } = mount(<ReactionButton value={null} onChange={change} />);
    await user.click(screen.getByRole('button', { name: 'რეაქციის არჩევა' }));
    const picker = screen.getByRole('toolbar', { name: 'პოსტის რეაქციები' });
    expect(within(picker).getAllByRole('button').map(button => button.getAttribute('aria-label')))
        .toEqual(['საიმედო ხელები', 'ცეცხლია', 'სიცილით მოვკვდი', 'სასტიკია', 'წითელი ბარათი', 'გულდასაწყვეტია']);
    await user.click(within(picker).getByRole('button', { name: 'ცეცხლია' }));
    expect(change).toHaveBeenLastCalledWith('LOVE');
    rerender(<MemoryRouter><ReactionButton value="LOVE" onChange={change} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'ცეცხლია' }));
    expect(change).toHaveBeenLastCalledWith(null);
});

it('translates reaction counts, list filters and historical Care while keeping profile links', async () => {
    api.get.mockResolvedValue({ data: { people: [{ userId: 22, name: 'Player One', reaction: 'CARE', avatarUrl: null }], totalCount: 1,
        reactionCounts: { CARE: 1 }, availableCount: 1, nextCursor: null, hasMore: false } });
    mount(<ReactionSummary post={{ ...post, likeCount: 1, reactionCount: 1, reactionCounts: { CARE: 1 } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'თანადგომა, 1 რეაქცია' }));
    const dialog = screen.getByRole('dialog', { name: 'რეაქციები' });
    expect(within(dialog).getByRole('tab', { name: 'ყველა, 1 რეაქცია' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: 'თანადგომა, 1 რეაქცია' })).toHaveAttribute('aria-selected', 'true');
    expect(await within(dialog).findByRole('link', { name: /Player One/ })).toHaveAttribute('href', '/profile/22');
});

it('keeps a denied Georgian comment draft and does not submit it twice', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('offline'));
    mount(card(post, submit, true));
    const input = screen.getByRole('textbox', { name: 'კომენტარის დაწერა პოსტზე: Academy Coach' });
    fireEvent.change(input, { target: { value: 'ჩემი მონახაზი' } });
    fireEvent.click(screen.getByRole('button', { name: 'კომენტარის გამოქვეყნება' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('კომენტარი ვერ გამოქვეყნდა. მონახაზი შენახულია.');
    expect(input).toHaveValue('ჩემი მონახაზი');
    expect(submit).toHaveBeenCalledExactlyOnceWith(7, 'ჩემი მონახაზი');
});

it('retains an edit conflict draft and save preconditions behind translated controls', async () => {
    api.put.mockRejectedValue(new Error('conflict'));
    const saved = vi.fn(); mount(<EditPostDialog post={post} onClose={vi.fn()} onSaved={saved} />);
    const input = screen.getByRole('textbox', { name: 'პოსტის ტექსტი' });
    fireEvent.change(input, { target: { value: 'ჩემი ცვლილება' } });
    fireEvent.click(screen.getByRole('button', { name: 'ცვლილებების შენახვა' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ცვლილებები ვერ შეინახა. მონახაზი შენახულია.');
    expect(input).toHaveValue('ჩემი ცვლილება'); expect(saved).not.toHaveBeenCalled();
    expect(api.put).toHaveBeenCalledWith('/posts/7', expect.objectContaining({ expectedContent: post.content, expectedPublic: true }));
});

it('preserves share caption, audience and retry identity across a language switch', async () => {
    api.post.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { postId: 80 } });
    const shared = vi.fn(); mount(<SharePostDialog post={post} onClose={vi.fn()} onShared={shared} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'დაწერეთ ამ პოსტზე' }), { target: { value: 'ჩემი კომენტარი' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'აუდიტორია' }), { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: 'გაზიარება' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('პოსტი ვერ გაზიარდა. მონახაზი შენახულია');
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(screen.getByRole('textbox', { name: 'Say something about this post' })).toHaveValue('ჩემი კომენტარი');
    expect(screen.getByRole('combobox', { name: 'Audience' })).toHaveValue('false');
    fireEvent.click(screen.getByRole('button', { name: 'Share now' }));
    await waitFor(() => expect(shared).toHaveBeenCalledOnce());
    expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]);
    expect(api.post).toHaveBeenLastCalledWith('/posts/7/shares', expect.objectContaining({ content: 'ჩემი კომენტარი', isPublic: false }));
});

it('requires an explicit translated report reason and preserves its enum and receipt', async () => {
    api.post.mockResolvedValue({ data: { id: 55 } });
    mount(<ReportPostDialog post={post} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'შეტყობინების გაგზავნა' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'სპამი ან არასასურველი რეკლამა' }));
    fireEvent.click(screen.getByRole('button', { name: 'შეტყობინების გაგზავნა' }));
    expect(await screen.findByRole('link', { name: 'შეტყობინების ჩანაწერის ნახვა' })).toHaveAttribute('href', '/reports?itemId=55');
    expect(api.post).toHaveBeenCalledWith('/reports', expect.objectContaining({ reason: 'SPAM', targetType: 'POST', requestId: expect.any(String) }));
});

it('keeps restricted sharing disabled in Georgian', async () => {
    mount(<SharePostDialog post={{ ...post, isPublic: false }} onClose={vi.fn()} onShared={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'გაზიარება' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'გაგზავნა: Dinamo staff' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ბმულის კოპირება' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
});
