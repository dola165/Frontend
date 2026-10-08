import { useState, useCallback, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { X, Check, Loader2, RotateCcw } from 'lucide-react';

interface ImageCropperModalProps {
    isOpen: boolean;
    imageUrl: string;
    aspectRatio: number;
    title: string;
    onClose: () => void;
    onCropComplete: (croppedAreaPixels: Area) => void;
    isProcessing?: boolean;
    error?: string;
    roundPreview?: boolean;
}

export const ImageCropperModal = (props: ImageCropperModalProps) => props.isOpen
    ? createPortal(<CropDialog key={props.imageUrl} {...props} />, document.body) : null;

function CropDialog({ imageUrl, aspectRatio, title, onClose, onCropComplete, isProcessing, error, roundPreview }: ImageCropperModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
    const [loadError, setLoadError] = useState('');
    const dialog = useRef<HTMLDivElement>(null);
    const controls = useRef({ isProcessing, onClose });
    const titleId = useId(), helpId = useId(), zoomId = useId();
    useEffect(() => { controls.current = { isProcessing, onClose }; }, [isProcessing, onClose]);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.current?.focus();
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); if (!controls.current.isProcessing) controls.current.onClose(); }
            if (event.key !== 'Tab') return;
            const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []).filter(item => !item.hidden);
            const first = items[0], last = items[items.length - 1];
            if (!first) { event.preventDefault(); dialog.current?.focus(); return; }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', handleKey);
        return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = overflow; previous?.focus(); };
    }, []);
    const onCropChange = useCallback((point: Point) => setCrop(point), []);
    const onCropCompleteInternal = useCallback((_area: Area, pixels: Area) => setCroppedPixels(pixels), []);
    return <div className="fixed inset-0 bg-[color:var(--color-overlay)]/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
        <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={helpId} aria-busy={isProcessing} className="bg-[color:var(--color-surface)] text-[color:var(--color-text)] w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] rounded-xl border border-[color:var(--color-border)] shadow-2xl overflow-hidden flex flex-col h-[80dvh] sm:h-[640px] outline-none">
            <div className="shrink-0 p-4 border-b border-[color:var(--color-border)] flex justify-between items-center gap-3">
                <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                <button type="button" onClick={onClose} disabled={isProcessing} aria-label="Close image cropper" className="p-2 rounded hover:bg-[color:var(--color-surface)] disabled:opacity-50"><X size={20}/></button>
            </div>
            <p id={helpId} className="px-4 pt-3 text-sm text-[color:var(--color-secondary)]">Drag the photo to reposition it. Use the arrow keys on the photo, or adjust the zoom below.</p>
            <div className="relative min-h-[140px] flex-1 bg-[color:var(--color-page)] my-3" aria-label="Crop preview">
                <Cropper image={imageUrl} crop={crop} zoom={zoom} aspect={aspectRatio} onCropChange={onCropChange} onZoomChange={setZoom} onCropComplete={onCropCompleteInternal}
                    cropShape={roundPreview ? 'round' : 'rect'} objectFit="contain" maxZoom={4} zoomWithScroll={false}
                    onInteractionStart={() => setCroppedPixels(null)}
                    mediaProps={{ onError: () => setLoadError('This photo could not be read. Close this window and choose another image.') }}
                    style={{ containerStyle: isProcessing ? { pointerEvents: 'none' } : undefined }} />
            </div>
            {(error || loadError) && <p role="alert" className="px-4 pb-3 text-sm text-[color:var(--color-danger)]">{error || loadError}</p>}
            <div className="shrink-0 p-4 border-t border-[color:var(--color-border)] space-y-4">
                <div className="flex items-center gap-3"><label htmlFor={zoomId} className="text-sm">Zoom</label><input id={zoomId} type="range" value={zoom} min={1} max={4} step={0.01} disabled={isProcessing} onChange={event => setZoom(Number(event.target.value))} className="min-w-0 flex-1 accent-[var(--color-accent)]"/><output className="text-sm w-12">{Math.round(zoom * 100)}%</output><button type="button" disabled={isProcessing} onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }} aria-label="Reset crop" className="p-2 rounded hover:bg-[color:var(--color-surface)]"><RotateCcw size={18}/></button></div>
                <div className="flex justify-end gap-3"><button type="button" onClick={onClose} disabled={isProcessing} className="px-5 py-2.5 rounded text-[color:var(--color-text)] hover:bg-[color:var(--color-surface)] disabled:opacity-50">Cancel</button><button type="button" onClick={() => { if (croppedPixels) onCropComplete(croppedPixels); }} disabled={!croppedPixels || isProcessing || !!loadError} className="bg-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)] px-5 py-2.5 rounded font-semibold flex items-center gap-2 disabled:opacity-50">{isProcessing ? <><Loader2 size={18} className="animate-spin"/>Saving…</> : <><Check size={18}/>Save photo</>}</button></div>
            </div>
        </div>
    </div>;
}
