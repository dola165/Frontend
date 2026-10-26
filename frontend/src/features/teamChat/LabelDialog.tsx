import './team-chat-media.css';
import { useEffect, useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchTags, labelMedia, type Labelled, type MediaSource, type MediaTag } from './api';
import { MAX_TAG, MAX_TAGS, MAX_TITLE, splitTags, withTags } from './mediaWords';
import { problem, shortDay } from './teamChatWords';

/** The file being named: where it lives, its own file name, and its name and tags now. */
export interface LabelTarget {
    source: MediaSource; id: number; fileName: string; title: string | null; tags: string[];
    labelledBy: { name: string | null } | null; labelledAt: string | null;
}

/**
 * Naming and tagging a picture, video or file, so people find it ("Dinamo arena entrance", "kit", "contracts"). The
 * file's own name stays as the fallback. Tags are suggested from those already in use; Enter or a comma adds one.
 * Saved for everyone who sees the file, with who changed it last.
 */
export function LabelDialog({ target, onClose, onSaved }: { target: LabelTarget; onClose: () => void; onSaved: (labelled: Labelled) => void }) {
    const copy = useJourneyCopy();
    const nameId = useId(), tagId = useId(), hintId = useId();
    const [title, setTitle] = useState(target.title ?? '');
    const [tags, setTags] = useState<string[]>(target.tags);
    const [typed, setTyped] = useState('');
    const [suggested, setSuggested] = useState<MediaTag[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // Tags in use, those holding what is typed; asked a moment after typing stops.
    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetchTags(typed.trim(), controller.signal).then(setSuggested).catch(() => { if (!controller.signal.aborted) setSuggested([]); });
        }, typed ? 200 : 0);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [typed]);

    const add = (words: string[]) => { setTags(current => withTags(current, words)); setTyped(''); };
    const full = tags.length >= MAX_TAGS;
    const offered = suggested.filter(tag => !tags.includes(tag.tag)).slice(0, 8);
    const save = async () => {
        setBusy(true); setError('');
        const all = typed.trim() ? withTags(tags, splitTags(typed)) : tags;
        try { onSaved(await labelMedia(target.source, target.id, { title: title.trim() || null, tags: all })); }
        catch (failure) { setError(problem(copy, failure, ['The name and tags were not saved.', 'სახელი და თეგები ვერ შეინახა.'])); setBusy(false); }
    };

    return <Dialog open size="sm" className="tc-dialog tc-label" title={copy('Name and tags', 'სახელი და თეგები')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy(`So everyone finds it. The file's own name stays: ${target.fileName}`, `რომ ყველამ იპოვოს. ფაილის საკუთარი სახელი რჩება: ${target.fileName}`)}
        footer={<>
            <Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant="primary" disabled={busy} onClick={() => void save()}>{busy ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</Button>
        </>}>
        <form className="tc-label__form" onSubmit={event => { event.preventDefault(); void save(); }}>
            <label className="tc-label__field" htmlFor={nameId}>
                <span>{copy('Name', 'სახელი')}</span>
                <input id={nameId} className="gk-input" value={title} maxLength={MAX_TITLE} autoFocus placeholder={target.fileName}
                    onChange={event => setTitle(event.target.value)} />
            </label>
            <div className="tc-label__field">
                <label htmlFor={tagId}>{copy('Tags', 'თეგები')} <span className="tc-faint gk-num">{tags.length}/{MAX_TAGS}</span></label>
                {tags.length > 0 && <ul className="tc-label__tags" aria-label={copy('Its tags', 'მისი თეგები')}>
                    {tags.map(tag => <li key={tag}><span>{tag}</span>
                        <button type="button" aria-label={copy(`Remove the tag ${tag}`, `თეგის მოხსნა: ${tag}`)} onClick={() => setTags(current => current.filter(other => other !== tag))}><X aria-hidden="true" /></button>
                    </li>)}
                </ul>}
                <input id={tagId} className="gk-input" value={typed} maxLength={MAX_TAG * 2} disabled={full} aria-describedby={hintId}
                    placeholder={full ? copy('That is the most tags a file takes', 'ფაილს მეტი თეგი აღარ ეტევა') : copy('kit, stadium, contracts…', 'ფორმა, სტადიონი, ხელშეკრულება…')}
                    onChange={event => { const value = event.target.value; if (/[,;]/.test(value)) add(splitTags(value)); else setTyped(value); }}
                    onKeyDown={event => {
                        if (event.key === 'Enter' && typed.trim()) { event.preventDefault(); add([typed]); }
                        if (event.key === 'Backspace' && !typed && tags.length) setTags(current => current.slice(0, -1));
                    }} />
                <p id={hintId} className="tc-faint tc-label__hint">{copy('Enter or a comma adds a tag.', 'Enter ან მძიმე თეგს ამატებს.')}</p>
                {offered.length > 0 && !full && <div className="tc-label__suggested" role="group" aria-label={copy('Tags in use', 'გამოყენებული თეგები')}>
                    {offered.map(tag => <button key={tag.tag} type="button" className="tc-label__suggestion" onClick={() => add([tag.tag])}>
                        <Plus aria-hidden="true" />{tag.tag}<span className="tc-faint gk-num">{tag.uses}</span>
                    </button>)}
                </div>}
            </div>
            {target.labelledBy && target.labelledAt && <p className="tc-faint">
                {copy(`Last changed by ${target.labelledBy.name ?? 'someone'}, ${shortDay(copy, target.labelledAt)}`,
                    `ბოლოს შეცვალა ${target.labelledBy.name ?? 'ვიღაცამ'}, ${shortDay(copy, target.labelledAt)}`)}
            </p>}
        </form>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
