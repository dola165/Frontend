import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { EditableMedia, SavedCopy } from '../imageEditor/EditImageButton';
import { loadEditor } from '../imageEditor/editorLoader';
import { rememberCopy } from '../imageEditor/useEditedFrom';

const ImageEditor = lazy(loadEditor);

/**
 * The picture editor opened from a menu ("Edit picture") rather than its button: the same editor, the same "Save as
 * new" (the copy goes where the original is), opened at once. Closing comes back to where the menu was.
 */
export function PictureEditor({ media, onClose, onSaved }: { media: EditableMedia; onClose: () => void; onSaved?: (saved: SavedCopy, image: File) => void }) {
    const copy = useJourneyCopy();
    return <ErrorBoundary fallback={<Dialog open size="sm" role="alertdialog" title={copy('The editor could not open', 'რედაქტორი ვერ გაიხსნა')}
        description={copy('Check the connection and try again.', 'შეამოწმეთ კავშირი და სცადეთ თავიდან.')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<Button onClick={onClose}>{copy('Close', 'დახურვა')}</Button>} />}>
        <Suspense fallback={<Dialog open size="sm" title={copy('Edit picture', 'სურათის რედაქტირება')} description={copy('Opening the editor…', 'რედაქტორი იხსნება…')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')} />}>
            <ImageEditor media={media} onClose={onClose} onSaved={(saved, image) => { rememberCopy(saved); onSaved?.(saved, image); }} />
        </Suspense>
    </ErrorBoundary>;
}
