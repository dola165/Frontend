import { useRef, type ChangeEvent } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '../../design/primitives';
import { useIdentityImageEditor } from '../../hooks/useIdentityImageEditor';
import { ImageCropperModal } from '../../ui/ImageCropperModal';
import { CROP_IMAGE_ACCEPT } from '../../utils/cropImageHelper';

type ImageKind = 'logo' | 'avatar';

/**
 * Cover and crest/avatar editing for a profile header: hidden file pickers, the crop dialog
 * and the upload, offered only when the viewer may change them.
 */
export function useProfileImageControls<K extends ImageKind>({ enabled, scope, imageKind, hasCover, onSave }: {
    enabled: boolean; scope: string; imageKind: K; hasCover: boolean;
    onSave: (field: 'banner' | K, url: string) => Promise<void>;
}) {
    const editor = useIdentityImageEditor(async (kind, url) => {
        if (!enabled) throw new Error('You do not have permission to change these photos.');
        await onSave(kind === 'banner' ? 'banner' : imageKind, url);
    }, `${scope}:${enabled}`);
    const coverInput = useRef<HTMLInputElement>(null), imageInput = useRef<HTMLInputElement>(null);
    const pick = (event: ChangeEvent<HTMLInputElement>, kind: 'banner' | K) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (enabled) void editor.select(file, kind);
    };
    const busy = editor.uploading;
    const imageName = imageKind === 'logo' ? 'club crest' : 'profile photo';
    const coverAction = enabled ? <>
        <input ref={coverInput} type="file" hidden accept={CROP_IMAGE_ACCEPT} onChange={event => pick(event, 'banner')} />
        <Button size="sm" disabled={!!busy} onClick={() => coverInput.current?.click()}>
            {busy === 'banner' ? <Loader2 className="gk-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}{hasCover ? 'Change cover' : 'Add cover'}
        </Button>
    </> : null;
    const imageAction = enabled ? <>
        <input ref={imageInput} type="file" hidden accept={CROP_IMAGE_ACCEPT} onChange={event => pick(event, imageKind)} />
        <Button size="sm" iconOnly disabled={!!busy} aria-label={busy === imageKind ? `Uploading ${imageName}` : `Change ${imageName}`} onClick={() => imageInput.current?.click()}>
            {busy === imageKind ? <Loader2 className="gk-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
        </Button>
    </> : null;
    const dialogs = <>
        {editor.error && !editor.source && <p role="alert" className="gk-notice gk-notice--danger">{editor.error}</p>}
        {editor.source && <ImageCropperModal isOpen imageUrl={editor.source.imageUrl}
            title={editor.source.type === 'banner' ? 'Adjust cover photo' : imageKind === 'logo' ? 'Adjust club crest' : 'Adjust profile photo'}
            aspectRatio={editor.source.type === 'banner' ? 3 : 1} roundPreview={editor.source.type === 'avatar'}
            onClose={editor.close} onCropComplete={editor.save} isProcessing={!!busy} error={editor.error} />}
    </>;
    return { coverAction, imageAction, dialogs };
}
