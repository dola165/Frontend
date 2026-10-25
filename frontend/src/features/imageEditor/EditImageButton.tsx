import './image-editor.css';
import { lazy, Suspense, useState } from 'react';
import { PencilLine } from 'lucide-react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Dialog } from '../../design/Dialog';
import { Button, type ButtonVariant } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { SavedCopy } from './api';
import { loadEditor } from './editorLoader';
import type { EditableMedia } from './ImageEditor';
import { rememberCopy } from './useEditedFrom';

export type { EditableMedia } from './ImageEditor';
export type { SavedCopy } from './api';

const ImageEditor = lazy(loadEditor);

/**
 * "Edit" for a picture someone can see. Opens the editor; "Save as new" stores the result as a new picture where the
 * original is (the same task, or a reply waiting in the chat's message box) and calls `onSaved` with it and the edited
 * file. The original never changes.
 */
export function EditImageButton({ media, onSaved, variant = 'ghost', size = 'sm', iconOnly = false }: {
    media: EditableMedia; onSaved?: (saved: SavedCopy, image: File) => void; variant?: ButtonVariant; size?: 'sm' | 'md'; iconOnly?: boolean;
}) {
    const copy = useJourneyCopy();
    const [opening, setOpening] = useState(0);
    const label = copy('Edit', 'რედაქტირება');
    const close = () => setOpening(0);
    return <>
        <Button variant={variant} size={size} iconOnly={iconOnly} aria-label={iconOnly ? copy('Edit the picture', 'სურათის რედაქტირება') : undefined}
            title={copy('Crop, draw, blur… saved as a new picture', 'ჭრა, ხატვა, დაბინდვა… შეინახება ახალ სურათად')}
            onPointerEnter={() => void loadEditor()} onFocus={() => void loadEditor()} onClick={() => setOpening(Date.now())}>
            <PencilLine aria-hidden="true" />{!iconOnly && label}
        </Button>
        {opening > 0 && <ErrorBoundary key={opening} fallback={<Dialog open size="sm" role="alertdialog" title={copy('The editor could not open', 'რედაქტორი ვერ გაიხსნა')}
            description={copy('Check the connection and try again.', 'შეამოწმეთ კავშირი და სცადეთ თავიდან.')} onClose={close} closeLabel={copy('Close', 'დახურვა')}
            footer={<Button onClick={close}>{copy('Close', 'დახურვა')}</Button>} />}>
            <Suspense fallback={<Dialog open size="sm" title={copy('Edit picture', 'სურათის რედაქტირება')} description={copy('Opening the editor…', 'რედაქტორი იხსნება…')} onClose={close} closeLabel={copy('Close', 'დახურვა')} />}>
                <ImageEditor media={media} onClose={close} onSaved={(saved, image) => { rememberCopy(saved); onSaved?.(saved, image); }} />
            </Suspense>
        </ErrorBoundary>}
    </>;
}
