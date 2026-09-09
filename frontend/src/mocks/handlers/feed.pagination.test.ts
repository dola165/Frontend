import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { feedHandlers } from './feed';
import { userHandlers } from './users';
import { posts, currentUserId, followedClubIds, resetStore } from '../data/store';
vi.mock('../utils', async importOriginal => ({ ...await importOriginal<typeof import('../utils')>(), simulateLatency: async () => {} }));
const server = setupServer(...feedHandlers, ...userHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { resetStore(); server.resetHandlers(); });
afterAll(() => server.close());
const get = async (query = '', following = false) => (await fetch(`http://localhost/api/posts/feed/${following ? 'following' : 'for-you'}${query}`)).json();
function seed() {
    currentUserId(1);
    for (let id = 1; id <= 45; id++) posts().set(id, { id, authorId: 2, clubId: 8, content: String(id), imageUrl: null,
        likeCount: 0, commentCount: 0, createdAt: `2026-01-01T12:0${id % 7}:00` });
}
it('mock discovery traverses timestamp ties across three pages after boundary deletion', async () => {
    seed();
    const expected = [...posts().values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id).map(post => post.id);
    const first = await get(); const boundary = first.posts.at(-1);
    posts().delete(boundary.id);
    const second = await get(`?cursor=${first.nextCursor}&cursorTime=${boundary.createdAt}`);
    const last = second.posts.at(-1);
    const third = await get(`?cursor=${second.nextCursor}&cursorTime=${last.createdAt}`);
    expect([...first.posts, ...second.posts, ...third.posts].map(post => post.id)).toEqual(expected);
    expect(third.nextCursor).toBeNull();
});
it('people and club follows move posts between the two demo views; anonymous Following is empty', async () => {
    seed();
    expect((await get('', true)).posts).toEqual([]);
    await fetch('http://localhost/api/users/2/follow', { method: 'POST' });
    expect((await get()).posts).toEqual([]);
    expect((await get('', true)).posts).toHaveLength(20);
    await fetch('http://localhost/api/users/2/follow', { method: 'POST' });
    followedClubIds().add(8);
    expect((await get('', true)).posts).toHaveLength(20);
    currentUserId(null);
    expect((await get('', true)).posts).toEqual([]);
    expect((await get()).posts).toHaveLength(20);
});
