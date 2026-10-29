import { useState } from 'react';
import { WorkMediaList as SharedMediaList } from '../../components/work/WorkMedia';
import { fileName } from '../../components/work/workWords';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { EditImageButton } from '../imageEditor/EditImageButton';
import { EditedImageNote } from '../imageEditor/EditedImageNote';
import { LabelDialog } from '../teamChat/LabelDialog';
import { TagList } from '../teamChat/MediaBits';
import { PictureEditor } from '../teamChat/PictureEditor';
import { deleteMedia, fetchDetail, playLink, type Detail, type WorkMedia as Media } from './api';

export { AttachButton } from '../../components/work/WorkMedia';

/**
 * What is attached under a task, with Team work's own tools on top of the shared list: name and tag a file, edit a
 * picture (the copy is kept beside it), and remove (the uploader or a system admin).
 */
export function WorkMediaList({ itemId, media, onChanged }: { itemId: number; media: Media[]; onChanged: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const [labelling, setLabelling] = useState<Media | null>(null);
    const [editing, setEditing] = useState<Media | null>(null);
    const [error, setError] = useState('');
    const refresh = () => fetchDetail(itemId).then(onChanged).catch(failure => setError(extractApiErrorMessage(failure, copy('Saved, but the task could not refresh. Open it again to see it.', 'შეინახა, მაგრამ საქმე ვერ განახლდა. ხელახლა გახსენით.'))));
    return <SharedMediaList media={media} onChanged={onChanged}
        actions={{ remove: id => deleteMedia(itemId, id), playLink: id => playLink(itemId, id) }}
        tools={{
            label: setLabelling,
            edit: setEditing,
            note: item => <EditedImageNote url={item.url} />,
            tags: item => <TagList tags={item.tags} />,
            lightboxFooter: (item, close) => <EditImageButton media={{ url: item.url, name: item.name, place: { itemId } }} variant="secondary" onSaved={() => {
                close();
                fetchDetail(itemId).then(onChanged).catch(failure => setError(extractApiErrorMessage(failure, copy('The copy was saved, but the task could not refresh. Open it again to see it.', 'ასლი შეინახა, მაგრამ საქმე ვერ განახლდა. ხელახლა გახსენით.'))));
            }} />,
        }}>
        {labelling && <LabelDialog target={{ source: 'TASK', id: labelling.id, fileName: fileName(labelling, copy('file', 'ფაილი')), title: labelling.title ?? null, tags: labelling.tags ?? [],
            labelledBy: labelling.labelledBy ?? null, labelledAt: labelling.labelledAt ?? null }} onClose={() => setLabelling(null)} onSaved={() => { setLabelling(null); void refresh(); }} />}
        {editing && <PictureEditor media={{ url: editing.url, name: editing.name, place: { itemId } }} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </SharedMediaList>;
}
