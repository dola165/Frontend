import { http, HttpHandler, HttpResponse } from 'msw';
import { posts, comments, users, clubs, currentUserId, followedClubIds } from '../data/store';
import { createComment } from '../data/factories';
import { simulateLatency } from '../utils';

const API = '*/api';

const enrichPost = (p: ReturnType<typeof posts> extends Map<number, infer T> ? T : never) => {
  const author = users().get(p.authorId);
  return {
    id: p.id,
    content: p.content,
    createdAt: p.createdAt,
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

// Returns FeedResponseDto-shaped object with cursor-based pagination
const feedResponse = (cursor?: number | null, limit = 20) => {
  const sorted = [...posts().values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const items = cursor != null ? sorted.filter((p) => p.id < cursor) : sorted;
  const page = items.slice(0, limit);
  return {
    posts: page.map(enrichPost),
    nextCursor: page.length === limit ? page[page.length - 1]?.id ?? null : null,
    hasMore: items.length > limit,
  };
};

export const feedHandlers: HttpHandler[] = [

  // -- GET /posts/feed (global, cursor-based) --
  http.get(`${API}/posts/feed`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor') ? Number(url.searchParams.get('cursor')) : null;
    const limit = Number(url.searchParams.get('limit') ?? 20);
    return HttpResponse.json(feedResponse(cursor, limit));
  }),

  // -- GET /posts/feed/for-you --
  http.get(`${API}/posts/feed/for-you`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor') ? Number(url.searchParams.get('cursor')) : null;
    const limit = Number(url.searchParams.get('limit') ?? 20);
    return HttpResponse.json(feedResponse(cursor, limit));
  }),

  // -- GET /posts/feed/following --
  http.get(`${API}/posts/feed/following`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor') ? Number(url.searchParams.get('cursor')) : null;
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const followed = followedClubIds();
    const sorted = [...posts().values()]
      .filter((p) => p.clubId != null && followed.has(p.clubId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = cursor != null ? sorted.filter((p) => p.id < cursor) : sorted;
    const page = items.slice(0, limit);
    return HttpResponse.json({
      posts: page.map(enrichPost),
      nextCursor: page.length === limit ? page[page.length - 1]?.id ?? null : null,
      hasMore: items.length > limit,
    });
  }),

  // -- GET /posts/user/{userId} --
  http.get(`${API}/posts/user/:userId`, async ({ params, request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor') ? Number(url.searchParams.get('cursor')) : null;
    const limit = Number(url.searchParams.get('limit') ?? 20);

    const sorted = [...posts().values()]
      .filter((p) => p.authorId === Number(params.userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = cursor != null ? sorted.filter((p) => p.id < cursor) : sorted;
    const page = items.slice(0, limit);
    return HttpResponse.json({
      posts: page.map(enrichPost),
      nextCursor: page.length === limit ? page[page.length - 1]?.id ?? null : null,
      hasMore: items.length > limit,
    });
  }),

  // -- GET /posts/club/{clubId} --
  http.get(`${API}/posts/club/:clubId`, async ({ params, request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor') ? Number(url.searchParams.get('cursor')) : null;
    const limit = Number(url.searchParams.get('limit') ?? 20);

    const sorted = [...posts().values()]
      .filter((p) => p.clubId === Number(params.clubId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = cursor != null ? sorted.filter((p) => p.id < cursor) : sorted;
    const page = items.slice(0, limit);
    return HttpResponse.json({
      posts: page.map(enrichPost),
      nextCursor: page.length === limit ? page[page.length - 1]?.id ?? null : null,
      hasMore: items.length > limit,
    });
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
