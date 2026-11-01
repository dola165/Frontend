import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, Camera, EyeOff, HeartHandshake, Medal, Shield, Sparkles, UserPlus, Users, X, type LucideIcon } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { activityColors } from '../schedule/activityIcons';
import { FollowButton } from '../actions/FollowButton';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { PostDialog } from '../../components/feed/PostDialogs';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/formatting';
import { SOCIAL_IMAGE_ACCEPT, validateSocialImage } from '../../utils/socialImageUpload';
import type { FeedPostDto } from '../../components/feed/FeedPost';
import type { RecordPost } from './postTopics';
import { RecordMatchLines } from './RecordMatchLines';
import './record-post.css';

type Copy = ReturnType<typeof useJourneyCopy>;

/** The quiet mark that tells a post the club's records wrote from a person's ("From the trial"). */
const MARK: Record<RecordPost['kind'], [string, string]> = {
    TRIAL: ['From the trial', 'სინჯებიდან'],
    SQUAD: ['From the squad', 'გუნდიდან'],
    JOB: ['From the job', 'ვაკანსიიდან'],
    PROJECT: ['From the project', 'პროექტიდან'],
    TOURNAMENT: ['From the tournament', 'ტურნირიდან'],
    CLUB: ['New club', 'ახალი კლუბი'],
    RESULTS: ['From the results', 'შედეგებიდან'],
    WEEKEND: ['This weekend', 'ამ შაბათ-კვირას'],
};

const markOf = (record: RecordPost): [string, string] => record.kind === 'TOURNAMENT' && record.moment === 'WINNERS' ? ['From the results', 'შედეგებიდან'] : MARK[record.kind];

export function RecordMark({ record }: { record: RecordPost }) {
    const copy = useJourneyCopy();
    const [en, ka] = markOf(record);
    return <span className="record-mark"><Sparkles aria-hidden="true" />{copy(en, ka)}</span>;
}

/** Each kind's symbol, the activity colours where it is one (trials pink, matches green). */
const LOOK: Record<RecordPost['kind'], { icon: LucideIcon; color: string }> = {
    TRIAL: { icon: UserPlus, color: activityColors.TRYOUT },
    SQUAD: { icon: Users, color: activityColors.TRYOUT },
    JOB: { icon: BriefcaseBusiness, color: 'var(--color-purple)' },
    PROJECT: { icon: HeartHandshake, color: 'var(--color-cyan)' },
    TOURNAMENT: { icon: Medal, color: activityColors.MATCH },
    CLUB: { icon: Shield, color: 'var(--feed-accent)' },
    RESULTS: { icon: Medal, color: activityColors.MATCH },
    WEEKEND: { icon: Medal, color: activityColors.MATCH },
};

const HOURS: Record<string, [string, string]> = {
    FULL_TIME: ['Full time', 'სრული განაკვეთი'], PART_TIME: ['Part-time', 'ნახევარი განაკვეთი'], SESSIONS: ['By the session', 'ვარჯიშების მიხედვით'],
    MATCHDAYS: ['Matchdays', 'მატჩის დღეები'], VOLUNTEER: ['Volunteer', 'მოხალისე'], PAID: ['Paid', 'ანაზღაურებადი'],
};
const STATE: Partial<Record<NonNullable<RecordPost['state']>, [string, string]>> = {
    CANCELLED: ['Cancelled', 'გაუქმებულია'], CLOSED: ['Closed', 'დახურულია'], FILLED: ['Places filled', 'ადგილები შევსებულია'],
    EXPIRED: ['Over', 'დასრულდა'], PAUSED: ['Paused', 'შეჩერებულია'], DONE: ['Done', 'დასრულებულია'],
    SCHEDULED: ['Not started yet', 'ჯერ არ დაწყებულა'], ENDED: ['Ended', 'დასრულდა'],
};

const day = (iso?: string | null) => iso ? formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
const date = (iso?: string | null) => iso ? formatDate(iso, { day: 'numeric', month: 'short' }) : null;
const money = (value?: string | null) => value == null ? null : Number(value).toLocaleString('en-US');

/** What the card says: a title and one quiet line, in the record's own words. */
function words(record: RecordPost, copy: Copy): { title: string; line: string | null } {
    const title = record.title ?? '';
    const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || null;
    switch (record.kind) {
        case 'RESULTS': case 'WEEKEND': return { title: copy(...MARK[record.kind]), line: null };
        case 'TRIAL': return { title, line: join(day(record.startsAt), record.placeName, record.ageGroup) };
        case 'SQUAD': return { title: copy(`${title} is taking players`, `${title} იღებს მოთამაშეებს`), line: join(record.ageGroup, record.gender === 'FEMALE' ? copy('Girls', 'გოგონები') : record.gender === 'MALE' ? copy('Boys', 'ბიჭები') : record.gender === 'MIXED' ? copy('Mixed', 'შერეული') : null) };
        case 'JOB': return { title, line: record.hours && HOURS[record.hours] ? copy(...HOURS[record.hours]) : null };
        case 'PROJECT': {
            const step = record.moment === 'HALFWAY' ? copy('halfway', 'ნახევარი გზა') : record.moment === 'GOAL' ? copy('goal reached', 'მიზანი მიღწეულია') : record.moment === 'DONE' ? copy('done', 'დასრულებულია') : null;
            const amount = record.reportedAmount != null && record.goalAmount != null
                ? copy(`${money(record.reportedAmount)} of ${money(record.goalAmount)} ${record.currency ?? ''} · reported by the club`, `${money(record.reportedAmount)} / ${money(record.goalAmount)} ${record.currency ?? ''} · კლუბის მონაცემებით`)
                : record.goalAmount != null ? copy(`Goal ${money(record.goalAmount)} ${record.currency ?? ''}`, `მიზანი ${money(record.goalAmount)} ${record.currency ?? ''}`) : null;
            return { title: join(title, step) ?? title, line: amount };
        }
        case 'TOURNAMENT': return record.moment === 'WINNERS'
            ? { title: copy(`${title}: the winners`, `${title}: გამარჯვებულები`), line: record.winner ?? null }
            : { title, line: join([date(record.startsAt), date(record.endsAt)].filter(Boolean).join('–') || null, record.placeName) };
        case 'CLUB': return { title: record.placeName ? copy(`New in ${record.placeName}`, `ახალი კლუბი — ${record.placeName}`) : copy('A new club', 'ახალი კლუბი'), line: (record.ages ?? []).join(' · ') || null };
    }
}

const ACTION: Record<NonNullable<RecordPost['action']>, { words: [string, string]; to?: (record: RecordPost) => string }> = {
    APPLY: { words: ['Apply', 'განაცხადი'], to: r => `/tryouts/${r.recordId}` },
    ASK: { words: ['Ask about joining', 'ჰკითხეთ გაწევრიანებაზე'], to: r => `/admissions/opportunities/${r.recordId}` },
    VIEW_JOB: { words: ['View the job', 'ვაკანსიის ნახვა'], to: r => `/jobs/${r.recordId}` },
    SUPPORT: { words: ['Support', 'მხარდაჭერა'], to: r => `/campaigns/${r.recordId}` },
    ENTER: { words: ['Enter', 'დარეგისტრირება'], to: r => `/tournaments/${r.recordId}` },
    FOLLOW: { words: ['Follow', 'გამოწერა'] },
};

/** The record as the post shows it: its symbol, title and line, the one action, or the state that ended it. */
export function RecordPostCard({ post }: { post: FeedPostDto }) {
    const copy = useJourneyCopy();
    const record = post.record!;
    const [following, setFollowing] = useState(record.following ?? undefined);
    if (record.kind === 'RESULTS' || record.kind === 'WEEKEND') return <RecordMatchLines record={record} />;
    const look = LOOK[record.kind];
    const { title, line } = words(record, copy);
    const action = record.action ? ACTION[record.action] : null;
    const state = !record.action && record.state ? STATE[record.state] : undefined;
    const ended = state ? copy(...state) : null;
    const progress = record.kind === 'PROJECT' && record.reportedAmount != null && record.goalAmount
        ? Math.min(100, Math.round(Number(record.reportedAmount) / Number(record.goalAmount) * 100)) : null;
    return <div className="record-post" data-kind={record.kind}>
        <span className="record-post__icon" style={{ color: look.color }}><look.icon aria-hidden="true" /></span>
        <span className="record-post__text">
            <strong>{title}</strong>
            {line && <small>{line}</small>}
            {progress != null && <span className="record-post__bar" role="img" aria-label={copy(`${progress}% of the goal`, `მიზნის ${progress}%`)}><i style={{ width: `${progress}%` }} /></span>}
        </span>
        {record.action === 'FOLLOW' && post.clubId != null
            ? <FollowButton look="plain" className="record-post__act" subject={{ kind: 'club', id: post.clubId }} following={following} name={post.clubName ?? undefined} onChange={setFollowing} />
            : action?.to ? <Link className="record-post__act" to={action.to(record)}>{copy(...action.words)}</Link>
                : ended ? <span className="record-post__ended">{ended}</span> : null}
    </div>;
}

/** Saves staff's line, photos (`null` keeps them) and visibility on a written post; the server answers with the post. */
const saveRecordPost = (post: FeedPostDto, change: { line: string | null; mediaIds: number[] | null; hidden: boolean }) =>
    apiClient.put<FeedPostDto>(`/posts/${post.id}/record`, { ...change, version: post.record!.version }).then(response => response.data);

/** A hidden written post as its staff see it: the mark, and showing it again in one click. */
export function HiddenRecordNote({ post, onSaved }: { post: FeedPostDto; onSaved: (post: FeedPostDto) => void }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const show = async () => {
        if (busy) return;
        setBusy(true); setError('');
        try { onSaved(await saveRecordPost(post, { line: post.record!.line ?? null, mediaIds: null, hidden: false })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Couldn’t save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <p className="record-post-hidden">
        <EyeOff aria-hidden="true" />{copy('Hidden: only the club’s posters see it', 'დამალულია: მას მხოლოდ კლუბის ავტორები ხედავენ')}
        {post.record?.canChange && <button type="button" className="record-post__again" disabled={busy} onClick={() => void show()}>{copy('Show again', 'ხელახლა ჩვენება')}</button>}
        {error && <span role="alert" className="post-error">{error}</span>}
    </p>;
}

/**
 * Staff who may post for the club (for the squad, on a squad's post) add one line and photos to a post its records
 * wrote, or hide it for everyone; it stays one post. The server's answer replaces the post.
 */
export function RecordPostChanges({ post, onClose, onSaved }: { post: FeedPostDto; onClose: () => void; onSaved: (post: FeedPostDto) => void }) {
    const copy = useJourneyCopy();
    const record = post.record!;
    const [line, setLine] = useState(record.line ?? '');
    // The photos already on the post first (staff get their ids, in the card's order), then any added here; a photo
    // leaves only when its own button removes it.
    const [existing] = useState(() => (record.photoIds ?? []).map((id, index) => ({ key: `photo-${id}`, url: resolveMediaUrl(post.mediaUrls?.[index] ?? '') ?? '', id })));
    const [photos, setPhotos] = useState<{ key: string; url: string; id?: number; file?: File }[]>(existing);
    const photosChanged = photos.length !== existing.length || photos.some((photo, index) => photo.key !== existing[index].key);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const picker = useRef<HTMLInputElement>(null);
    const save = async (hidden: boolean) => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            const mediaIds: number[] = [];
            for (const photo of photos) {
                if (photo.id) { mediaIds.push(photo.id); continue; }
                const form = new FormData();
                form.append('file', photo.file!, photo.file!.name);
                const uploaded = await apiClient.post<{ id: number }>('/media/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                mediaIds.push(uploaded.data.id);
            }
            onSaved(await saveRecordPost(post, { line: line.trim() || null, mediaIds: photosChanged ? mediaIds : null, hidden }));
            onClose();
        } catch (failure) {
            setError(extractApiErrorMessage(failure, copy('Couldn’t save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.')));
        } finally { setBusy(false); }
    };
    const add = (files: FileList | null) => {
        const chosen = Array.from(files ?? []).filter(file => !validateSocialImage(file)).slice(0, 10 - photos.length);
        setPhotos(current => [...current, ...chosen.map(file => ({ key: `${file.name}-${file.lastModified}`, url: URL.createObjectURL(file), file }))]);
    };
    return <PostDialog title={copy('Add to this post', 'პოსტზე დამატება')} busy={busy} onClose={onClose}>
        <div className="record-change">
            <label className="record-change__line">
                <span>{copy('One line from the club', 'ერთი სტრიქონი კლუბისგან')}</span>
                <textarea value={line} maxLength={500} rows={3} disabled={busy} onChange={event => setLine(event.target.value)}
                    placeholder={copy('Come and meet us on Saturday…', 'მობრძანდით შაბათს…')} />
            </label>
            {photos.length > 0 && <ul className="record-change__photos">
                {photos.map(photo => <li key={photo.key}><MediaImage src={photo.url} alt="" />
                    <button type="button" aria-label={copy('Remove photo', 'ფოტოს წაშლა')} onClick={() => setPhotos(current => current.filter(item => item.key !== photo.key))}><X aria-hidden="true" /></button></li>)}
            </ul>}
            <input ref={picker} type="file" multiple hidden accept={SOCIAL_IMAGE_ACCEPT} onChange={event => { add(event.target.files); event.target.value = ''; }} />
            {error && <p role="alert" className="post-error">{error}</p>}
            <footer>
                <button type="button" className="post-secondary" disabled={busy} onClick={() => picker.current?.click()}><Camera aria-hidden="true" />{copy('Photos', 'ფოტოები')}</button>
                <button type="button" className="post-secondary" disabled={busy} onClick={() => void save(!record.hidden)}>
                    {record.hidden ? copy('Show again', 'ხელახლა ჩვენება') : <><EyeOff aria-hidden="true" />{copy('Hide for everyone', 'ყველასთვის დამალვა')}</>}
                </button>
                <button type="button" className="post-primary" disabled={busy} onClick={() => void save(record.hidden)}>{busy ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</button>
            </footer>
        </div>
    </PostDialog>;
}
