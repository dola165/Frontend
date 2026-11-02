import '../../src/index.css';
import '../../src/components/layout/home-feed.css';
import '../../src/styles/product-identity.css';
// Synthetic browser evidence only. Real components; no live account, server or provider.
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';
import { apiClient } from '../../src/api/axiosConfig';
import { FeedPage } from '../../src/pages/FeedPage';
import { PostPage } from '../../src/pages/PostPage';
import { ReportReceipts } from '../../src/features/moderation/ReportReceipts';
import { setStoredAccessToken, setStoredUserId } from '../../src/utils/authStorage';
import type { CommentDto, FeedPostDto } from '../../src/components/feed/FeedPost';
import i18n from '../../src/i18n';

void i18n.changeLanguage('en');
document.documentElement.classList.toggle('dark', new URLSearchParams(location.search).get('theme') === 'dark');
setStoredUserId(42); setStoredAccessToken('synthetic-ui-only');
const createdAt = '2026-10-30T07:00:00Z';
const posts: FeedPostDto[] = Array.from({ length: 8 }, (_, i) => ({ id: 20 - i, content: `Training update ${20 - i}: the next session starts at 10:00. Bring water and arrive ready to play.`, authorName: 'Synthetic coach', clubName: 'FC Dinamo Tbilisi Academy (synthetic)', clubId: 1, authorId: 51, createdAt, likeCount: 0, commentCount: 1, isLikedByMe: false, isPublic: true, mediaUrls: i === 4 ? ['/uploads/publishing-fixture.jpg'] : [], why: { kind: 'FOLLOWING', tier: 2, name: 'FC Dinamo Tbilisi Academy (synthetic)' } }));
const threads = new Map<number, CommentDto[]>(posts.map(post => [post.id, [{ id: post.id * 100, content: 'Please confirm the meeting place.', authorName: 'Synthetic parent', createdAt, canEdit: true, version: 0, likeCount: 0 }]]));
const requests = new Map<string, CommentDto>();
let failedCreate = false, revoked = false, nextId = 3000;
const hidden = new Set<number>();
window.addEventListener('synthetic-publishing-conflict', () => {
    const comment = threads.get(16)?.find(comment => comment.id >= 3000);
    if (comment) Object.assign(comment, { content: 'Changed in another synthetic tab', version: (comment.version ?? 0) + 1 });
});
let receipt: { id: number; targetType: string; reason: string; status: string; createdAt: string } | null = null;
apiClient.interceptors.request.clear(); apiClient.interceptors.response.clear();
apiClient.defaults.adapter = async config => {
    const url = config.url ?? '', method = config.method?.toUpperCase(), body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const deny = (status = 404) => { throw new AxiosError('Synthetic unavailable', 'ERR_BAD_REQUEST', config, undefined, { status, data: { detail: 'This item is no longer available.' } } as AxiosResponse); };
    let data: unknown;
    const match = url.match(/^\/posts\/(\d+)(.*)$/);
    if (url.includes('/uploads/')) data = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#326846"/><path d="M40 40H920V500H40ZM480 40V500" stroke="white" fill="none" stroke-width="4"/><circle cx="480" cy="270" r="80" fill="none" stroke="white" stroke-width="4"/><text x="70" y="90" fill="white" font-size="24">SYNTHETIC TRAINING MEDIA</text></svg>'], { type: 'image/svg+xml' });
    else if (url === '/posts/authors') data = [];
    else if (url.startsWith('/posts/feed')) {
        const cursor = config.params?.cursor;
        const page = (cursor ? posts.slice(4) : posts.slice(0, 4)).filter(post => !hidden.has(post.id));
        data = { posts: page, nextCursor: cursor ? null : 17, nextCursorTier: cursor ? null : 2 };
    } else if (url === '/chat/conversations') data = { content: [], totalElements: 0 };
    else if (url === '/reports' && method === 'POST') data = receipt = { id: 55, targetType: 'POST', reason: body.reason, status: 'OPEN', createdAt };
    else if (url === '/reports/55' || url === '/reports') data = url === '/reports' ? [receipt] : receipt;
    else if (match) {
        const id = Number(match[1]), tail = match[2], post = posts.find(post => post.id === id), comments = threads.get(id) ?? [];
        if (!post || (revoked && id === 16)) deny();
        if (tail === '' && method === 'GET') data = { ...post, commentCount: comments.filter(comment => !comment.deleted).length };
        else if (tail === '/comments' && method === 'GET') data = comments;
        else if (tail === '/comments' && method === 'POST') {
            const key = String(config.headers.get('Idempotency-Key'));
            if (!requests.has(key)) { const comment = { id: nextId++, content: body.content, parentId: body.parentId, authorName: 'Synthetic coach', createdAt, canEdit: true, version: 0, likeCount: 0 }; comments.push(comment); requests.set(key, comment); }
            if (!failedCreate) { failedCreate = true; throw new Error('Synthetic acknowledgement lost'); }
            data = requests.get(key);
        } else if (/^\/comments\/\d+/.test(tail)) {
            const comment = comments.find(row => row.id === Number(tail.split('/')[2])); if (!comment) deny();
            if (tail.endsWith('/reaction')) Object.assign(comment!, { likeCount: body.liked ? 1 : 0, isLikedByMe: body.liked });
            else if (method === 'DELETE') Object.assign(comment!, { content: '', deleted: true, version: (comment!.version ?? 0) + 1 });
            else { if (body.expectedVersion !== (comment!.version ?? 0)) deny(409); Object.assign(comment!, { content: body.content, version: (comment!.version ?? 0) + 1, editedAt: createdAt }); }
            data = comment;
        } else if (tail === '/hide') { if (body.hidden) hidden.add(id); else hidden.delete(id); data = { hidden: body.hidden }; }
        else if (tail === '/shares') data = { postId: id };
        else deny();
    } else deny();
    return { data: JSON.parse(JSON.stringify(data instanceof Blob ? null : data)), ...(data instanceof Blob ? { data } : {}), status: 200, statusText: 'OK', config, headers: {} };
};
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/home']}><div className="feed-home-shell" style={{ minHeight: '100vh', padding: '16px', background: 'var(--color-page)' }}>
    <nav aria-label="Synthetic controls" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}><Link to="/home">Home</Link><Link to="/elsewhere">Other workspace</Link><button onClick={() => { revoked = true; }}>Revoke post access</button></nav>
    <Routes><Route path="/home" element={<FeedPage user={{ id: 42, fullName: 'Synthetic coach' }} />} /><Route path="/posts/:postId" element={<PostPage />} /><Route path="/reports" element={<ReportReceipts />} /><Route path="*" element={<Link to="/home">Return to Home</Link>} /></Routes>
</div></MemoryRouter>);
