import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, Loader2 } from 'lucide-react';

interface ImageCropperModalProps {
    isOpen: boolean;
    imageUrl: string;
    aspectRatio: number; // e.g., 1 for square (logo), 3 for banner (1200x400)
    title: string;
    onClose: () => void;
    onCropComplete: (croppedAreaPixels: any) => void;
    isProcessing?: boolean;
}

export const ImageCropperModal = ({ isOpen, imageUrl, aspectRatio, title, onClose, onCropComplete, isProcessing }: ImageCropperModalProps) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedPixels, setCroppedPixels] = useState(null);

    const onCropChange = useCallback((crop: any) => setCrop(crop), []);
    const onZoomChange = useCallback((zoom: number) => setZoom(zoom), []);

    // We just save the pixel coordinates when the user stops dragging
    const onCropCompleteInternal = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedPixels(croppedAreaPixels);
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col h-[80vh] sm:h-[600px]">

                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-lg font-black text-white uppercase tracking-widest">{title}</h2>
                    <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-rose-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Cropper Area */}
                <div className="relative flex-1 bg-slate-950/50">
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropCompleteInternal}
                        objectFit="horizontal-cover"
                    />
                </div>

                {/* Footer Controls */}
                <div className="p-5 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="w-full sm:w-1/2 flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase">Zoom</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full accent-emerald-500"
                        />
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        <button onClick={onClose} disabled={isProcessing} className="flex-1 sm:flex-none px-6 py-2.5 rounded font-bold uppercase text-xs tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                            Cancel
                        </button>
                        <button
                            onClick={() => onCropComplete(croppedPixels)}
                            disabled={!croppedPixels || isProcessing}
                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Apply Crop</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};