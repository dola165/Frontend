import { useEffect, useId, useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { offer } from '../teamChat/saveFile';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchBrief, fetchBriefPackage, type Brief } from './api';

const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Copy for AI on a task or a step: everything someone with no memory of the project needs to take it over, on any
 * computer. Copied as soon as it's gathered, and shown, so nobody wonders what went to the clipboard. A task with files
 * can be downloaded whole, with the brief inside.
 */
export function BriefDialog({ itemId, itemKey, onClose }: { itemId: number; itemKey: string; onClose: () => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [brief, setBrief] = useState<Brief | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchBrief(itemId, controller.signal).then(next => {
            if (controller.signal.aborted) return;
            setBrief(next);
            void navigator.clipboard?.writeText(next.text).then(() => { if (!controller.signal.aborted) setCopied(true); }).catch(() => undefined);
        }).catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('The brief could not be gathered.', 'ტექსტი ვერ შეგროვდა.'))); });
        return () => controller.abort();
    }, [itemId, copy]);
    const download = async () => {
        setSaving(true); setError('');
        try { offer(await fetchBriefPackage(itemId), `${itemKey}.zip`); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The files could not be downloaded.', 'ფაილები ვერ ჩამოიტვირთა.'))); }
        finally { setSaving(false); }
    };
    return <Dialog open size="lg" className="tw-dialog" title={copy(`Copy for AI · ${itemKey}`, `კოპირება AI-სთვის · ${itemKey}`)} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copied ? copy('Copied. Paste it into Claude or Codex on any computer and they can take this over. Paste their report back with Paste report.', 'დაკოპირდა. ჩასვით Claude-ში ან Codex-ში ნებისმიერ კომპიუტერზე და შეძლებენ ამის გაგრძელებას. მათი ანგარიში ჩასვით „ანგარიშის ჩასმით“.')
            : copy('Give it to Claude or Codex on any computer and they can take this over. Paste their report back with Paste report.', 'მიეცით Claude-ს ან Codex-ს ნებისმიერ კომპიუტერზე და შეძლებენ ამის გაგრძელებას. მათი ანგარიში ჩასვით „ანგარიშის ჩასმით“.')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Close', 'დახურვა')}</Button>
            {brief && brief.files > 0 && <Button disabled={saving} onClick={() => void download()}><Download aria-hidden="true" />{saving ? copy('Downloading…', 'იტვირთება…') : copy(`Download with files (${brief.files}, ${size(brief.fileBytes)})`, `ჩამოტვირთვა ფაილებით (${brief.files}, ${size(brief.fileBytes)})`)}</Button>}
            <Button variant="primary" disabled={!brief} onClick={() => { if (brief) void navigator.clipboard?.writeText(brief.text).then(() => setCopied(true)); }}>{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button></>}>
        <label htmlFor={id} className="gk-visually-hidden">{copy('The brief, as text', 'ტექსტი')}</label>
        <textarea id={id} className="gk-input work-paste__text" readOnly rows={14} value={brief?.text ?? (error ? '' : copy('Gathering everything Team work knows about this…', 'ვაგროვებთ ყველაფერს, რაც გუნდის სამუშაომ ამაზე იცის…'))} onFocus={event => event.target.select()} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
