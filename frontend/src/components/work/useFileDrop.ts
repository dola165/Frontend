import { useState, type DragEvent } from 'react';

const hasFiles = (event: DragEvent) => [...event.dataTransfer.types].includes('Files');

/** Files dropped on an area: `bind` goes on the area, `dragging` says a file is being held over it. */
export function useFileDrop(onFiles: (files: File[]) => void) {
    const [over, setOver] = useState(0);
    return {
        dragging: over > 0,
        bind: {
            onDragEnter: (event: DragEvent) => { if (hasFiles(event)) { event.preventDefault(); setOver(count => count + 1); } },
            onDragOver: (event: DragEvent) => { if (hasFiles(event)) event.preventDefault(); },
            onDragLeave: (event: DragEvent) => { if (hasFiles(event)) setOver(count => Math.max(0, count - 1)); },
            onDrop: (event: DragEvent) => { event.preventDefault(); setOver(0); if (event.dataTransfer.files.length) onFiles([...event.dataTransfer.files]); },
        },
    };
}
