import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PostComposer } from '../PostComposer';
import { authorKey, type PostAuthor } from '../../../features/feed/postAuthors';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); });

const club: PostAuthor = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', crestUrl: null, squadId: null, name: 'FC Dinamo Tbilisi Academy' };
const u16: PostAuthor = { ...club, squadId: 105, name: 'U16 Boys' };

function compose(choice?: PostAuthor) {
    const bodies: unknown[] = [];
    server.use(http.get('*/posts/authors', () => HttpResponse.json([club, u16])));
    server.use(http.post('*/posts', async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ postId: 7 }); }));
    const { container } = render(<MemoryRouter><PostComposer asSelf authors={[club, u16]} onPostCreated={() => {}} /></MemoryRouter>);
    const text = screen.getByRole('textbox', { name: 'Create a post' });
    fireEvent.focus(text);
    fireEvent.change(text, { target: { value: 'Thursday at 18:30 under the lights' } });
    const postAs = container.querySelector<HTMLSelectElement>('label.post-as select')!;
    if (choice) fireEvent.change(postAs, { target: { value: authorKey(choice) } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
    return { bodies, postAs };
}

it('posts for the squad chosen in "Post as", as its club', async () => {
    const { bodies, postAs } = compose(u16);
    // The person first, then the club, then its squad named with the club.
    expect([...postAs.options].map(option => option.value)).toEqual(['self', authorKey(club), authorKey(u16)]);
    expect(postAs.options[2].text).toBe('U16 Boys · FC Dinamo Tbilisi Academy');
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ content: 'Thursday at 18:30 under the lights', clubId: 1, isPublic: true, mediaIds: [], squadId: 105 });
});

it('posts as the club, or as the person by default, without a squad', async () => {
    const asClub = compose(club);
    await waitFor(() => expect(asClub.bodies).toHaveLength(1));
    expect(asClub.bodies[0]).toEqual({ content: 'Thursday at 18:30 under the lights', clubId: 1, isPublic: true, mediaIds: [] });
    cleanup();
    const asSelf = compose();
    await waitFor(() => expect(asSelf.bodies).toHaveLength(1));
    expect(asSelf.bodies[0]).toEqual({ content: 'Thursday at 18:30 under the lights', clubId: null, isPublic: true, mediaIds: [] });
});
