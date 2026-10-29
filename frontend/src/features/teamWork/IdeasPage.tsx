import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Hourglass, Plus, UploadCloud, Video, X } from 'lucide-react';
import { Button, PageHeader } from '../../design/primitives';
import { formatTime } from '../../utils/formatting';
import { extractApiErrorMessage } from '../../utils/apiError';
import { AgendaDays } from '../schedule/board/AgendaDays';
import { dayKey } from '../schedule/board/scheduleRange';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addComment, addPicture, addVideo, changePlan, changeWork, createPlan, createWork, VIDEO_LIMIT_MB, VIDEO_TYPES, type Detail, type Person, type PlanView, type WorkItem } from './api';
import { useDayTitle } from './useDayTitle';
import { FindingRow } from './FindingRow';
import { IDEAS, NOTE, WAITING } from './findings';
import { MentionInput } from '../../components/work/MentionInput';
import { NameField } from './WorkBits';
import { useFresh } from './useFresh';
import './team-work-agenda.css';

type Copy = ReturnType<typeof useJourneyCopy>;
const isVideo = (file: File) => file.type.startsWith('video/');
const nameOf = (file: File) => file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
const problemWith = (copy: Copy, file: File) => file.type.startsWith('image/') ? ''
    : !VIDEO_TYPES.includes(file.type) ? copy(`${file.name}: only pictures, and videos in MP4 or WebM.`, `${file.name}: მხოლოდ სურათები და MP4 ან WebM ვიდეო.`)
    : file.size > VIDEO_LIMIT_MB * 1024 * 1024 ? copy(`${file.name}: videos are up to ${VIDEO_LIMIT_MB} MB.`, `${file.name}: ვიდეო მაქსიმუმ ${VIDEO_LIMIT_MB} MB.`) : '';

/** A chosen file before it is sent: the picture itself, or a video mark with its name. */
function FilePreview({ file }: { file: File }) {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        if (isVideo(file)) return;
        const reader = new FileReader();
        let live = true;
        reader.onload = () => { if (live) setSrc(String(reader.result)); };
        reader.readAsDataURL(file);
        return () => { live = false; };
    }, [file]);
    return <span className="tw-drop__preview">{src ? <img src={src} alt="" /> : <><Video aria-hidden="true" /><span>{file.name}</span></>}</span>;
}

/**
 * The big "Drop it here": drag pictures and videos in, or choose them; then a name (taken from the first file)
 * and an optional comment where "@" tags who should look, and they arrive as one finding.
 */
function DropZone({ team, ensureIdeas, onDropped }: { team: Person[]; ensureIdeas: () => Promise<number>; onDropped: () => void }) {
    const copy = useJourneyCopy();
    const input = useRef<HTMLInputElement>(null);
    const purposeId = useId(), commentId = useId();
    const [files, setFiles] = useState<File[]>([]);
    const [name, setName] = useState('');
    const [purpose, setPurpose] = useState('');
    const [comment, setComment] = useState('');
    const [over, setOver] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);
    const [error, setError] = useState('');
    const take = (list: FileList | null) => {
        const picked = [...(list ?? [])];
        const good = picked.filter(file => !problemWith(copy, file));
        setError(picked.map(file => problemWith(copy, file)).filter(Boolean).join(' '));
        if (good.length === 0) return;
        setFiles(current => [...current, ...good]);
        setName(current => current || nameOf(good[0]));
    };
    const reset = () => { setFiles([]); setName(''); setPurpose(''); setComment(''); setError(''); };
    const send = async () => {
        if (!name.trim() || files.length === 0 || progress !== null) return;
        setError(''); setProgress(copy('Sending…', 'იგზავნება…'));
        try {
            const planId = await ensureIdeas();
            const made = await createWork({ title: name.trim(), status: 'PLANNED', planId, ...(purpose.trim() ? { description: purpose.trim() } : {}) });
            if (comment.trim()) await addComment(made.item.id, comment.trim());
            for (const [index, file] of files.entries()) {
                const label = files.length > 1 ? copy(`Uploading ${index + 1} of ${files.length}…`, `იტვირთება ${index + 1} / ${files.length}…`) : copy('Uploading…', 'იტვირთება…');
                setProgress(label);
                if (isVideo(file)) await addVideo(made.item.id, file, share => setProgress(`${label} ${Math.round(share * 100)}%`));
                else await addPicture(made.item.id, file);
            }
            reset(); onDropped();
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('It couldn’t be sent.', 'ვერ გაიგზავნა.'))); }
        finally { setProgress(null); }
    };
    const drag = (event: DragEvent, on: boolean) => { event.preventDefault(); setOver(on); };
    return <div className="tw-drop" data-over={over || undefined} onDragOver={event => drag(event, true)} onDragLeave={event => drag(event, false)}
        onDrop={event => { drag(event, false); take(event.dataTransfer.files); }}>
        {files.length === 0 ? <button type="button" className="tw-drop__zone" onClick={() => input.current?.click()}>
            <UploadCloud aria-hidden="true" />
            <span className="tw-drop__title">{copy('Drop it here', 'ჩააგდეთ აქ')}</span>
            <span className="tw-drop__hint">{copy(`or choose pictures and videos (MP4 or WebM, up to ${VIDEO_LIMIT_MB} MB)`, `ან აირჩიეთ სურათები და ვიდეოები (MP4 ან WebM, მაქს. ${VIDEO_LIMIT_MB} MB)`)}</span>
        </button>
            : <form className="tw-drop__form" onSubmit={event => { event.preventDefault(); void send(); }}>
                <ul className="tw-drop__files">
                    {files.map((file, index) => <li key={`${file.name}-${index}`}><FilePreview file={file} />
                        <button type="button" className="work-icon-button tw-drop__remove" disabled={progress !== null} aria-label={copy(`Take out ${file.name}`, `${file.name} — ამოღება`)}
                            onClick={() => setFiles(current => current.filter((_, at) => at !== index))}><X aria-hidden="true" /></button></li>)}
                    <li><button type="button" className="tw-drop__more" disabled={progress !== null} onClick={() => input.current?.click()} aria-label={copy('Add more files', 'მეტი ფაილის დამატება')}><Plus aria-hidden="true" /></button></li>
                </ul>
                <div className="tw-drop__fields">
                    <NameField value={name} autoFocus onChange={setName} />
                    <div className="tw-field"><label htmlFor={purposeId}>{copy('What it’s for (optional)', 'რისთვისაა (არასავალდებულო)')}</label>
                        <textarea id={purposeId} className="gk-input" rows={2} maxLength={400} value={purpose} placeholder={copy('The problem or the idea, in a sentence or two', 'პრობლემა ან იდეა, ერთი-ორი წინადადებით')} onChange={event => setPurpose(event.target.value)} /></div>
                    <div className="tw-field"><label htmlFor={commentId}>{copy('Comment (optional)', 'კომენტარი (არასავალდებულო)')}</label>
                        <MentionInput id={commentId} value={comment} team={team} placeholder={copy('What should the team look at? @ tags someone', 'რას უნდა შეხედოს გუნდმა? @ ვინმეს მონიშნავს')} onChange={setComment} /></div>
                    <div className="tw-drop__send">
                        <span className="gk-faint">{progress}</span>
                        <Button variant="ghost" size="sm" disabled={progress !== null} onClick={reset}>{copy('Cancel', 'გაუქმება')}</Button>
                        <Button variant="primary" size="sm" type="submit" disabled={progress !== null || !name.trim()}>{copy('Drop it', 'გაგზავნა')}</Button>
                    </div>
                </div>
            </form>}
        <input ref={input} type="file" multiple hidden accept={['image/*', ...VIDEO_TYPES].join(',')} aria-label={copy('Choose pictures and videos', 'სურათების და ვიდეოების არჩევა')}
            onChange={event => { take(event.target.files); event.target.value = ''; }} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}

/**
 * Ideas: anyone on the team drops what they found, a picture or a video with a name and a comment. Below, the ideas
 * day by day, newest first, in the agenda's look. Others mark one seen, acknowledge it (they keep it in mind) or
 * comment, and push what matters to Waiting, which counts as acknowledging it. Nothing here goes straight onto a plan.
 */
export function IdeasPage({ ideas, waiting, details, team, me, open, onOpen, onPut, onChanged }: {
    ideas: PlanView | undefined; waiting: PlanView | undefined; details: Map<number, Detail>; team: Person[]; me: number | null; open: number | null;
    onOpen: (id: number | null) => void; onPut: (detail: Detail) => void; onChanged: () => void;
}) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState('');
    const dayTitle = useDayTitle();
    const items = (ideas?.tasks ?? []).map(node => node.item).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const fresh = useFresh(ideas ? items.map(item => String(item.id)) : null);
    const days = new Map<string, WorkItem[]>();
    items.forEach(item => { const key = dayKey(new Date(item.createdAt)); days.set(key, [...days.get(key) ?? [], item]); });
    const ensureIdeas = async () => ideas ? ideas.plan.id : (await createPlan(IDEAS)).plan.id;
    const push = async (item: WorkItem) => {
        if (!ideas) return;
        setBusy(item.id); setError('');
        try {
            onPut(await changeWork(item.id, { version: details.get(item.id)?.item.version ?? item.version, update: NOTE.pushed }));
            const target = waiting ?? await createPlan(WAITING);
            await changePlan(target.plan.id, { version: target.plan.version, order: [...target.tasks.map(node => node.item.id), item.id] });
            await changePlan(ideas.plan.id, { version: ideas.plan.version, order: ideas.tasks.map(node => node.item.id).filter(id => id !== item.id) });
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('It couldn’t be moved to Waiting.', 'მოლოდინში ვერ გადავიდა.'))); }
        finally { setBusy(null); onChanged(); }
    };
    return <>
        <PageHeader title={copy('Ideas', 'იდეები')} subtitle={copy('A bug, an idea, a screen to change', 'ხარვეზი, იდეა, შესაცვლელი ეკრანი')} />
        <DropZone team={team} ensureIdeas={ensureIdeas} onDropped={onChanged} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        <section className="tw-block tw-agenda tw-fresh-rows" aria-label={copy(`Ideas: ${items.length}`, `იდეები: ${items.length}`)}>
            {items.length ? <AgendaDays className="tw-agenda__days" days={[...days].map(([key, list]) => {
                const { label, title, today } = dayTitle(key);
                return { key, title, label, today, rows: list.map(item => <FindingRow key={item.id} item={item} detail={details.get(item.id)} team={team} me={me} open={open === item.id}
                    time={formatTime(item.createdAt)} fresh={fresh.has(String(item.id))} onOpen={onOpen} onPut={onPut}
                    next={<Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void push(item)}><Hourglass aria-hidden="true" />{copy('Push to Waiting', 'მოლოდინში გადატანა')}</Button>} />) };
            })} />
                : <div className="tw-quiet-row" role="status"><span className="gk-muted">{copy('No ideas yet. Drop the first one above.', 'იდეები ჯერ არ არის. ჩააგდეთ პირველი ზემოთ.')}</span></div>}
        </section>
    </>;
}
