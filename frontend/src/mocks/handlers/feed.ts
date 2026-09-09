import { http, HttpHandler, HttpResponse } from 'msw';
import { posts, comments, users, clubs, currentUserId, followedClubIds, followedUserIds } from '../data/store';
import { createComment } from '../data/factories';
import { simulateLatency } from '../utils';

const API = '*/api';

const enrichPost = (p: ReturnType<typeof posts> extends Map<number, infer T> ? T : never) => {
  const author = users().get(p.authorId);
  return {
    id: p.id,
    content: p.content,
    createdAt: p.createdAt,
    authorId: p.authorId,
    authorName: author?.fullName ?? author?.username ?? 'Unknown',
    authorAvatarUrl: author?.avatarUrl ?? null,
    clubId: p.clubId ?? null,
    clubName: p.clubId ? clubs().get(p.clubId)?.name ?? null : null,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    isLikedByMe: false,
    image: p.imageUrl ?? undefined,
    mediaUrls: p.imageUrl ? [p.imageUrl] : [],
  };
};

const enrichComment = (c: ReturnType<typeof comments> extends Map<number, infer T> ? T : never) => {
  const author = users().get(c.authorId);
  return {
    id: c.id,
    authorName: author?.fullName ?? author?.username ?? 'Unknown',
    authorAvatarUrl: author?.avatarUrl ?? null,
    content: c.content,
    createdAt: c.createdAt,
  };
};

// The demo uses the same timestamp/ID cursor and lookahead as the real feed.
const feedResponse = (request: Request, scope: 'discovery' | 'following' | 'user' | 'club', id?: number) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.has('cursor') ? Number(url.searchParams.get('cursor')) : null;
  const cursorTime = url.searchParams.get('cursorTime');
  const chronological = scope === 'discovery' || scope === 'following';
  const limit = Number(url.searchParams.get('limit') ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor !== null && (!Number.isSafeInteger(cursor) || cursor < 1)) || (cursorTime && (cursor === null || !Number.isFinite(Date.parse(cursorTime)))))
    return HttpResponse.json({ error: 'Invalid feed cursor or limit' }, { status: 400 });
  const boundary = cursorTime ?? (cursor !== null ? posts().get(cursor)?.createdAt : null);
  if (chronological && cursor !== null && !boundary) return HttpResponse.json({ error: 'Feed cursor expired. Refresh the feed.' }, { status: 400 });
  const uid = currentUserId();
  const following = (post: ReturnType<typeof posts> extends Map<number, infer T> ? T : never) =>
    followedUserIds().has(post.authorId) || (post.clubId !== null && followedClubIds().has(post.clubId));
  const sorted = [...posts().values()].filter(post => {
    if (scope === 'user') return post.authorId === id;
    if (scope === 'club') return post.clubId === id;
    if (scope === 'following') return uid !== null && post.authorId !== uid && following(post);
    return uid === null || (post.authorId !== uid && !following(post));
  }).sort((a, b) => (chronological ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : 0) || b.id - a.id);
  const items = cursor === null ? sorted : sorted.filter(post =>
    chronological ? Date.parse(post.createdAt) < Date.parse(boundary!) || (Date.parse(post.createdAt) === Date.parse(boundary!) && post.id < cursor) : post.id < cursor);
  const page = items.slice(0, limit);
  return HttpResponse.json({ posts: page.map(enrichPost), nextCursor: (chronological ? items.length > limit : page.length === limit) ? page.at(-1)!.id : null });
};

export const feedHandlers: HttpHandler[] = [
  ...['/posts/feed', '/posts/feed/for-you'].map(path => http.get(`${API}${path}`, async ({ request }) => {
    await simulateLatency(); return feedResponse(request, 'discovery');
  })),
  http.get(`${API}/posts/feed/following`, async ({ request }) => {
    await simulateLatency(); return feedResponse(request, 'following');
  }),
  http.get(`${API}/posts/user/:userId`, async ({ request, params }) => {
    await simulateLatency(); return feedResponse(request, 'user', Number(params.userId));
  }),
  http.get(`${API}/posts/club/:clubId`, async ({ request, params }) => {
    await simulateLatency(); return feedResponse(request, 'club', Number(params.clubId));
  }),

  // -- POST /posts (returns { message, postId }) --
  http.post(`${API}/posts`, async ({ request }) => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as { content?: string; clubId?: number | null; isPublic?: boolean; mediaIds?: number[] };

    // We don't import createPost here to avoid the auto-increment side effect
    const newId = Math.max(0, ...[...posts().values()].map((p) => p.id)) + 1;
    posts().set(newId, {
      id: newId,
      authorId: uid,
      clubId: body.clubId ?? null,
      content: body.content ?? '',
      imageUrl: body.mediaIds?.length ? `https://picsum.photos/400/400?random=${newId}` : null,
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
    });

    return HttpResponse.json({ message: 'Post created', postId: newId }, { status: 201 });
  }),

  // -- DELETE /posts/{postId} --
  http.delete(`${API}/posts/:postId`, async ({ params }) => {
    await simulateLatency();
    posts().delete(Number(params.postId));
    return HttpResponse.json({ message: 'Post deleted successfully' });
  }),

  // -- POST /posts/:postId/like (returns { isLiked: boolean }) --
  http.post(`${API}/posts/:postId/like`, async ({ params }) => {
    await simulateLatency();
    const p = posts().get(Number(params.postId));
    if (p) p.likeCount++;
    return HttpResponse.json({ isLiked: true });
  }),

  // -- GET /posts/:postId/comments (returns flat List<CommentDto>, NOT paginated) --
  http.get(`${API}/posts/:postId/comments`, async ({ params }) => {
    await simulateLatency();
    const items = [...comments().values()]
      .filter((c) => c.postId === Number(params.postId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(enrichComment);

    return HttpResponse.json(items);
  }),

  // -- POST /posts/:postId/comments (returns 201 with CommentDto) --
  http.post(`${API}/posts/:postId/comments`, async ({ params, request }) => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as { content?: string };
    const newId = Math.max(0, ...[...comments().values()].map((c) => c.id)) + 1;
    const c = createComment({ postId: Number(params.postId), authorId: uid, content: body.content ?? '' });
    comments().set(newId, c);

    const p = posts().get(Number(params.postId));
    if (p) p.commentCount = (p.commentCount ?? 0) + 1;

    return HttpResponse.json(enrichComment(c), { status: 201 });
  }),

  // -- POST /posts/:postId/hide --
  http.post(`${API}/posts/:postId/hide`, async () => {
    await simulateLatency();
    return HttpResponse.json({ hidden: true });
  }),

  // -- POST /posts/:postId/interactions --
  http.post(`${API}/posts/:postId/interactions`, async () => {
    await simulateLatency();
    return HttpResponse.json({ recorded: true }, { status: 202 });
  }),
];
