import './image-editor.css';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPaste, ImagePlus } from 'lucide-react';
import FilerobotImageEditor, { TABS, TOOLS, type getCurrentImgDataFunction } from 'react-filerobot-image-editor';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { Dialog } from '../../design/Dialog';
import { Button, GkRoot } from '../../design/primitives';
import { useMediaSource } from '../../hooks/useMediaSource';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveCopy, type SavedCopy } from './api';
import { editorColours, type EditorColours } from './editorTheme';
import { EditorImages, TooBig, fileOf } from './editorImages';
import { addPicture, type EditorState } from './editorState';
import { editorTranslations } from './editorTranslations';

/** A picture to edit: its `/uploads/…` URL and, if known, its file name. */
export interface EditableMedia { url: string; name?: string | null }

/** The tools we offer, and only these; the library's filters, finetunes, watermark and resize stay hidden. */
const TAB_TOOLS = {
    [TABS.ADJUST]: [TOOLS.CROP, TOOLS.ROTATE, TOOLS.FLIP_X, TOOLS.FLIP_Y],
    [TABS.ANNOTATE]: [TOOLS.PEN, TOOLS.ARROW, TOOLS.RECT, TOOLS.TEXT],
    // The library's object-removal brush paints what our own blur then hides (EditorImages.blur).
    [TABS.AI]: [TOOLS.OBJECT_REMOVAL],
};
const TABS_SHOWN = [TABS.ADJUST, TABS.ANNOTATE, TABS.AI];
// Free, the original's shape, 16:9 and 9:16 come with the library; these are the other common ones.
const CROP = { presetsItems: [
    { titleKey: 'square', descriptionKey: '1:1', ratio: 1 },
    { titleKey: 'landscape', descriptionKey: '4:3', ratio: 4 / 3 },
    { titleKey: 'portrait', descriptionKey: '3:4', ratio: 3 / 4 },
] };
const ROTATE = { componentType: 'buttons' as const, angle: 90 };
const PEN = { strokeWidth: 4, selectAnnotationAfterDrawing: false };
const ARROW = { strokeWidth: 6, pointerLength: 18, pointerWidth: 18 };
const RECT = { fill: 'transparent', strokeWidth: 4 };
const PREVIEW_RATIO = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const baseName = (media: EditableMedia) => (media.name ?? media.url.split('/').pop() ?? 'picture').replace(/\.[^.]+$/, '').slice(0, 80) || 'picture';
const canPaste = () => typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';
/** Where the library puts its menus, colour picker and confirmations: in <body>, outside our dialog. */
const LIBRARY_POPUPS = '.SfxPopper-wrapper, .SfxModal-Wrapper, [class*="SfxDrawer"], [data-tippy-root]';

/** What the library hands its brush tool when the painting is applied. */
interface BlurRequest {
    getMaskedImage: (as: 'toCanvas') => HTMLCanvasElement;
    originalSource: HTMLImageElement;
    updateOriginalSourceFns: { setOriginalSource: (source: HTMLImageElement) => void };
}
type UpdateState = (change: (state: EditorState) => Partial<EditorState> | undefined) => void;

/**
 * Edits a picture and saves the result as a new one beside the original, which never changes. Our own frame (title,
 * Add picture, Cancel, Save as new, Escape and keyboard shortcuts, our words and colours) around a swappable editing
 * library: everything the library sees is set here, so replacing it touches this file only. Every canvas and object
 * URL it makes is let go on close.
 */
export default function ImageEditor({ media, onClose, onSaved }: { media: EditableMedia; onClose: () => void; onSaved: (saved: SavedCopy, image: File) => void }) {
    const copy = useJourneyCopy();
    const dialog = useRef<HTMLElement>(null);
    const pictureInput = useRef<HTMLInputElement>(null);
    const imageData = useRef<getCurrentImgDataFunction | undefined>(undefined);
    const updateState = useRef<UpdateState | undefined>(undefined);
    const saveAbort = useRef<AbortController | null>(null);
    const titleId = useId();
    const src = useMediaSource(media.url);
    const [images, setImages] = useState<EditorImages | null>(null);
    const [source, setSource] = useState<HTMLImageElement | null>(null);
    const [colours, setColours] = useState<EditorColours | null>(null);
    const [changed, setChanged] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');
    const [failed, setFailed] = useState(false);
    const markChanged = useCallback(() => setChanged(true), []);

    // One store of pictures per opening, let go when the editor closes (also under StrictMode's double mount).
    useEffect(() => {
        const store = new EditorImages();
        setImages(store);
        return () => { saveAbort.current?.abort(); store.release(); };
    }, []);
    useEffect(() => { if (dialog.current) setColours(editorColours(dialog.current)); }, []);
    useEffect(() => {
        if (!src || !images) return;
        let live = true;
        // Our own copy of the bytes, so the editor never depends on the viewer's shared copy staying alive.
        fetch(src).then(response => response.blob()).then(blob => images.fromBlob(blob))
            .then(image => { if (live) setSource(image); })
            .catch(() => { if (live) setFailed(true); });
        return () => { live = false; };
    }, [src, images]);

    const requestClose = useCallback(() => {
        if (saving) return;
        // Escape while writing a text on the picture, or in one of the library's pop-ups, only ends that.
        if (document.activeElement?.closest(LIBRARY_POPUPS)) return;
        if (typing(document.activeElement) && dialog.current?.querySelector('.ie-stage')?.contains(document.activeElement)) return;
        if (changed) setConfirming(true); else onClose();
    }, [changed, onClose, saving]);
    useDialogFocus(true, dialog, requestClose);
    // The dialog keeps focus inside itself; the library's own pop-ups count as inside, so its colour picker can be typed in.
    useEffect(() => {
        const section = dialog.current;
        if (!section) return undefined;
        const own = Node.prototype.contains;
        section.contains = node => own.call(section, node) || (node instanceof Element && node.closest(LIBRARY_POPUPS) !== null);
        return () => { Reflect.deleteProperty(section, 'contains'); };
    }, []);

    const add = useCallback(async (file: Blob | undefined) => {
        if (!file || !images || !source || !updateState.current) return;
        setError('');
        if (!file.type.startsWith('image/')) { setError(copy('That is not a picture.', 'ეს სურათი არ არის.')); return; }
        try {
            // Never larger than the picture it goes into, so a big photo costs no more memory than the picture itself.
            const picture = await images.fromBlob(file, Math.max(source.naturalWidth, source.naturalHeight));
            updateState.current(state => addPicture(state, picture));
            setChanged(true);
        } catch { setError(copy('That picture could not be added.', 'სურათი ვერ დაემატა.')); }
    }, [copy, images, source]);

    const paste = async () => {
        try {
            for (const item of await navigator.clipboard.read()) {
                const type = item.types.find(kind => kind.startsWith('image/'));
                if (type) { await add(await item.getType(type)); return; }
            }
            setError(copy('There is no picture to paste. Copy one first.', 'ჩასასმელი სურათი არ არის. ჯერ დააკოპირეთ.'));
        } catch { setError(copy('Paste with Ctrl+V (⌘V on a Mac), or let the browser read the clipboard.', 'ჩასვით Ctrl+V-ით (Mac-ზე ⌘V), ან ბრაუზერს მიეცით ბუფერის წაკითხვის უფლება.')); }
    };

    const save = useCallback(async () => {
        const read = imageData.current;
        if (!read || saving) return;
        setSaving(true); setError('');
        const controller = new AbortController();
        saveAbort.current = controller;
        let done: (() => void) | undefined;
        try {
            const { imageData: data, hideLoadingSpinner } = read({ name: baseName(media), extension: 'png' }, 1, true);
            done = hideLoadingSpinner;
            if (!data.imageCanvas) throw new Error('No picture.');
            const file = await fileOf(data.imageCanvas, baseName(media));
            const saved = await saveCopy(media.url, file.blob, file.name, controller.signal);
            onSaved(saved, new File([file.blob], file.name, { type: file.blob.type }));
            onClose();
        } catch (failure) {
            if (controller.signal.aborted) return;
            setError(failure instanceof TooBig
                ? copy('The picture is too big to save: at most 8192 pixels a side, 16 megapixels and 10 MB. Crop it smaller.', 'სურათი შესანახად ძალიან დიდია: მაქსიმუმ 8192 პიქსელი თითო მხარეს, 16 მეგაპიქსელი და 10 MB. ჩამოჭერით პატარად.')
                : extractApiErrorMessage(failure, copy('The copy could not be saved. Try again.', 'ასლი ვერ შეინახა. სცადეთ თავიდან.')));
        } finally {
            done?.();
            setSaving(false);
        }
    }, [copy, media, onClose, onSaved, saving]);

    // Undo and redo press the library's own buttons, so its history stays the one source of truth.
    useEffect(() => {
        const keys = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || typing(event.target)) return;
            const key = event.key.toLowerCase();
            const press = (selector: string) => { event.preventDefault(); dialog.current?.querySelector<HTMLButtonElement>(`${selector}:not([disabled])`)?.click(); };
            if (key === 'z' && !event.shiftKey) press('.FIE_buttons-undo-btn');
            else if ((key === 'z' && event.shiftKey) || key === 'y') press('.FIE_buttons-redo-btn');
            else if (key === 's') { event.preventDefault(); void save(); }
        };
        const pasted = (event: ClipboardEvent) => {
            if (typing(event.target)) return;
            const file = [...(event.clipboardData?.files ?? [])].find(item => item.type.startsWith('image/'));
            if (file) { event.preventDefault(); void add(file); }
        };
        document.addEventListener('keydown', keys);
        document.addEventListener('paste', pasted);
        return () => { document.removeEventListener('keydown', keys); document.removeEventListener('paste', pasted); };
    }, [add, save]);

    const blur = useCallback(async ({ getMaskedImage, updateOriginalSourceFns, originalSource }: BlurRequest) => {
        if (!images) return;
        try {
            updateOriginalSourceFns.setOriginalSource(await images.blur(originalSource, getMaskedImage('toCanvas')));
            setChanged(true);
        } catch { setError(copy('That part could not be blurred. Try again.', 'ეს ნაწილი ვერ დაიბინდა. სცადეთ თავიდან.')); }
    }, [copy, images]);
    const blurRef = useRef(blur);
    useEffect(() => { blurRef.current = blur; }, [blur]);

    // The library takes its settings once; new objects on every render would reset it mid-edit (tab, zoom, strokes).
    const settings = useMemo(() => colours && ({
        theme: colours.theme,
        translations: editorTranslations(copy),
        annotationsCommon: { stroke: colours.mark, fill: colours.mark, strokeWidth: 4, opacity: 1 },
        Text: { text: copy('Text', 'ტექსტი'), fill: colours.mark, fontSize: 32, fontFamily: 'Inter', fonts: ['Inter'] },
        ObjectRemoval: { strokeWidth: 60, onSubmitDraw: ((request: BlurRequest) => blurRef.current(request)) as never },
    }), [colours, copy]);

    const ready = source && settings;
    // The library sets its words in an effect after its first render, and its toolbar keeps the words it first drew;
    // mounting it once more, hidden, a frame later, shows ours from the start.
    const [shown, setShown] = useState(false);
    useEffect(() => { if (!ready) return undefined; const frame = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(frame); }, [ready]);
    return createPortal(<GkRoot className="ie-layer">
        <section ref={dialog} className="ie-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={saving || undefined}>
            <header className="ie-head">
                <div className="ie-head__titles">
                    <h2 id={titleId} className="ie-head__title">{copy('Edit picture', 'სურათის რედაქტირება')}</h2>
                    <p className="ie-head__hint">{copy('Saved as a new picture beside the original. The original stays as it is.', 'შეინახება ახალ სურათად ორიგინალის გვერდით. ორიგინალი არ იცვლება.')}</p>
                </div>
                <div className="ie-head__actions">
                    <Button size="sm" variant="ghost" disabled={!ready || saving} onClick={() => pictureInput.current?.click()} title={copy('Put another picture in, or paste one with Ctrl+V', 'ჩასვით სხვა სურათი, ან Ctrl+V-ით')}>
                        <ImagePlus aria-hidden="true" /><span className="ie-head__label">{copy('Add picture', 'სურათის ჩასმა')}</span>
                    </Button>
                    {canPaste() && <Button size="sm" variant="ghost" iconOnly disabled={!ready || saving} onClick={() => void paste()} aria-label={copy('Paste a picture', 'სურათის ჩასმა ბუფერიდან')} title={copy('Paste a picture (Ctrl+V)', 'სურათის ჩასმა (Ctrl+V)')}>
                        <ClipboardPaste aria-hidden="true" />
                    </Button>}
                    <Button size="sm" variant="ghost" disabled={saving} onClick={requestClose}>{copy('Cancel', 'გაუქმება')}</Button>
                    <Button size="sm" variant="primary" disabled={!ready || saving} onClick={() => void save()}>{saving ? copy('Saving…', 'ინახება…') : copy('Save as new', 'ახლის შენახვა')}</Button>
                </div>
                <input ref={pictureInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={event => { void add(event.target.files?.[0]); event.target.value = ''; }} />
            </header>
            {error && <p className="gk-notice gk-notice--danger ie-error" role="alert">{error}</p>}
            <div className="ie-stage" data-shown={shown || undefined}>
                {failed ? <p className="ie-stage__note" role="alert">{copy('The picture could not open.', 'სურათი ვერ გაიხსნა.')}</p>
                    : !ready ? <p className="ie-stage__note" role="status">{copy('Opening the picture…', 'სურათი იხსნება…')}</p>
                        : <FilerobotImageEditor key={shown ? 'shown' : 'first'}
                            source={source}
                            {...settings}
                            useBackendTranslations={false}
                            language="en"
                            tabsIds={TABS_SHOWN}
                            defaultTabId={TABS.ANNOTATE}
                            defaultToolId={TOOLS.ARROW}
                            useAiTab
                            removeSaveButton
                            observePluginContainerSize
                            avoidChangesNotSavedAlertOnLeave
                            savingPixelRatio={1}
                            previewPixelRatio={PREVIEW_RATIO}
                            getCurrentImgDataFnRef={imageData}
                            updateStateFnRef={updateState}
                            onModify={markChanged}
                            Pen={PEN}
                            Arrow={ARROW}
                            Rect={RECT}
                            Crop={CROP}
                            Rotate={ROTATE}
                            {...{ tabsToolsIds: TAB_TOOLS }}
                        />}
            </div>
        </section>
        {confirming && <Dialog open size="sm" role="alertdialog" title={copy('Discard your changes?', 'გავაუქმოთ ცვლილებები?')}
            description={copy('Nothing is saved. The original stays as it is.', 'არაფერი შეინახება. ორიგინალი არ იცვლება.')}
            onClose={() => setConfirming(false)} closeLabel={copy('Keep editing', 'რედაქტირების გაგრძელება')}
            footer={<>
                <Button variant="ghost" onClick={() => setConfirming(false)}>{copy('Keep editing', 'რედაქტირების გაგრძელება')}</Button>
                <Button variant="danger" onClick={onClose}>{copy('Discard', 'გაუქმება')}</Button>
            </>} />}
    </GkRoot>, document.body);
}
