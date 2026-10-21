import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { Button, EmptyNote, Panel, Section, Skeleton } from '../../design/primitives';
import { MediaImage } from '../../components/ui/MediaImage';
import type { FeedPostDto } from '../../components/feed/FeedPost';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession, type AuthSessionId } from '../../utils/authStorage';
import './profile-media.css';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

export type ProfileMediaType = 'pictures' | 'videos';
const isVideoUrl = (url: string) => /\.(mp4|mov|webm)(?:\?|$)/i.test(url);
type FeedPage = { posts?: FeedPostDto[]; nextCursor?: number | null };
type Navigation = { cursor: number | null; page: number; direction: 'older' | 'newer' };
type GalleryState = { posts: FeedPostDto[]; cursor: number | null; pageStarts: (number | null)[]; page: number; retryNavigation?: Navigation; loading: boolean; error: string | null };

/**
 * Photos or videos from a club's or a person's posts, one page of posts at a time.
 * `clubId` keeps a club gallery to that club's own posts.
 */
export function ProfileMedia({ endpoint, mediaType, clubId }: { endpoint: string; mediaType: ProfileMediaType; clubId?: number }) {
    const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    return <Gallery key={`${sessionId ?? 'guest'}:${endpoint}:${mediaType}`} endpoint={endpoint} clubId={clubId} mediaType={mediaType} sessionId={sessionId} />;
}

function Gallery({ endpoint, clubId, mediaType, sessionId }: { endpoint: string; clubId?: number; mediaType: ProfileMediaType; sessionId: AuthSessionId }) {
    const copy = useJourneyCopy();
    const [state, setState] = useState<GalleryState>({ posts: [], cursor: null, pageStarts: [null], page: 0, loading: true, error: null });
    const active = useRef(true), request = useRef<AbortController | null>(null), generation = useRef(0);
    const videos = mediaType === 'videos';
    const load = useCallback(async (navigation?: Navigation) => {
        if (!active.current || !isCurrentAuthSession(sessionId)) return;
        const cursor = navigation?.cursor ?? null;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const visit = ++generation.current;
        const current = () => active.current && visit === generation.current && isCurrentAuthSession(sessionId);
        setState(previous => ({ ...previous, loading: true, error: null }));
        try {
            const config: AuthSessionRequestConfig = { _authSessionId: sessionId, signal: controller.signal, params: { cursor: cursor ?? undefined, limit: 20 } };
            const response = await apiClient.get<FeedPage>(endpoint, config);
            if (!current()) return;
            if (!Array.isArray(response.data.posts)) throw new Error('The media page could not be read.');
            const next = response.data.nextCursor ?? null;
            if (next !== null && (!Number.isSafeInteger(next) || next <= 0 || (cursor !== null && next >= cursor))) throw new Error('The media page did not advance. Please retry.');
            const posts = response.data.posts.filter(post => Number.isSafeInteger(post.id) && post.id > 0 && (clubId == null || post.clubId == null || post.clubId === clubId));
            setState(previous => {
                const seen = new Set(navigation?.direction === 'older' ? previous.posts.map(post => post.id) : []);
                const unique = posts.filter(post => !seen.has(post.id) && Boolean(seen.add(post.id)));
                return { posts: unique, cursor: next,
                    pageStarts: navigation?.direction === 'older' ? [...previous.pageStarts.slice(0, navigation.page), cursor] : navigation ? previous.pageStarts : [null],
                    page: navigation?.page ?? 0, retryNavigation: undefined, loading: false, error: null };
            });
        } catch (error) {
            if (current() && !controller.signal.aborted) setState(previous => ({ ...previous, loading: false, retryNavigation: navigation, error: extractApiErrorMessage(error, 'Media could not load. Please try again.') }));
        } finally {
            if (current()) request.current = null;
        }
    }, [endpoint, clubId, sessionId]);

    useEffect(() => {
        active.current = true;
        void load();
        return () => { active.current = false; request.current?.abort(); };
    }, [load]);

    const media = useMemo(() => state.posts.flatMap(post => (post.mediaUrls?.length ? post.mediaUrls : post.image ? [post.image] : [])
        .map((url, index) => ({ url, index, postId: post.id, title: post.content || post.clubName || post.authorName })))
        .filter(item => isVideoUrl(resolveMediaUrl(item.url) ?? '') === videos), [state.posts, videos]);
    const errorText = state.error === 'The media page could not be read.' ? copy(state.error, 'მედიის გვერდი ვერ ჩაიტვირთა.')
        : state.error === 'The media page did not advance. Please retry.' ? copy(state.error, 'მედიის შემდეგი გვერდი ვერ ჩაიტვირთა. სცადეთ ხელახლა.')
        : state.error === 'Media could not load. Please try again.' ? copy(state.error, 'მედია ვერ ჩაიტვირთა. სცადეთ ხელახლა.') : state.error;

    return <Section title={videos ? copy('Videos', 'ვიდეოები') : copy('Photos', 'ფოტოები')} className="gk-media" action={<Button size="sm" variant="ghost" disabled={state.loading} onClick={() => void load()}>{videos ? copy('Refresh videos', 'ვიდეოების განახლება') : copy('Refresh photos', 'ფოტოების განახლება')}</Button>}>
        {state.error && <div role="alert" className="gk-notice gk-notice--danger"><span>{errorText}</span><Button size="sm" disabled={state.loading} onClick={() => void load(state.retryNavigation)}>{copy('Retry media', 'ხელახლა ცდა')}</Button></div>}
        {!state.loading && !state.error && media.length === 0 && <Panel><EmptyNote title={state.cursor ? copy(`No ${videos ? 'videos' : 'photos'} in the posts loaded so far.`, videos ? 'ჩატვირთულ პოსტებში ვიდეოები არ არის.' : 'ჩატვირთულ პოსტებში ფოტოები არ არის.') : copy(`No ${videos ? 'videos' : 'photos'} published yet.`, videos ? 'ვიდეოები ჯერ არ გამოქვეყნებულა.' : 'ფოტოები ჯერ არ გამოქვეყნებულა.')}>
            {state.cursor ? copy('Load older posts to keep looking.', 'სანახავად ჩატვირთეთ ძველი პოსტები.') : copy(`${videos ? 'Videos' : 'Photos'} shared in posts appear here.`, videos ? 'პოსტებში გაზიარებული ვიდეოები აქ გამოჩნდება.' : 'პოსტებში გაზიარებული ფოტოები აქ გამოჩნდება.')}
        </EmptyNote></Panel>}
        {media.length > 0 && <ul className="gk-media__grid">{media.map(item => <li key={`${item.postId}:${item.index}`}>
            <Link className="gk-media__item" to={`/posts/${item.postId}?media=${item.index}`} aria-label={copy(`Open ${videos ? 'video' : 'photo'} ${item.index + 1} from ${item.title}`, `${videos ? 'ვიდეოს' : 'ფოტოს'} გახსნა ${item.index + 1}: ${item.title}`)}>
                {videos ? <span className="gk-media__video"><PlayCircle aria-hidden="true" /></span> : <MediaImage src={resolveMediaUrl(item.url) || ''} alt="" loading="lazy" />}
                <span className="gk-media__caption">{item.title}</span>
            </Link>
        </li>)}</ul>}
        {state.loading && <div role="status" aria-label={videos ? copy('Loading videos', 'ვიდეოები იტვირთება') : copy('Loading photos', 'ფოტოები იტვირთება')} className="gk-media__loading"><Skeleton height={140} /><Skeleton height={140} /><Skeleton height={140} /></div>}
        {(state.page > 0 || (state.cursor !== null && !state.error)) && <nav className="gk-media__pages" aria-label={videos ? copy('Video pages', 'ვიდეოების გვერდები') : copy('Photo pages', 'ფოტოების გვერდები')}>
            {state.page > 0 && <Button size="sm" disabled={state.loading} onClick={() => void load({ cursor: state.pageStarts[state.page - 1], page: state.page - 1, direction: 'newer' })}>{copy('Newer posts', 'ახალი პოსტები')}</Button>}
            {state.page > 1 && <Button size="sm" disabled={state.loading} onClick={() => void load()}>{copy('Back to latest', 'ბოლო პოსტებზე დაბრუნება')}</Button>}
            {state.cursor !== null && !state.error && <Button size="sm" disabled={state.loading} onClick={() => void load({ cursor: state.cursor, page: state.page + 1, direction: 'older' })}>{copy('Load older posts', 'ძველი პოსტების ჩატვირთვა')}</Button>}
        </nav>}
    </Section>;
}
