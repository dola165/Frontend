/**
 * The pictures the editor works with, and their memory. Every object URL and canvas made here is kept in one place and
 * let go together when the editor closes, so opening and closing it leaves nothing behind.
 */

/**
 * The longest side the editor works at. Team work and team chat pictures are stored at most 1920 px (the image
 * pipeline's cap), so they are always edited, and saved, at their full stored size; only something larger (an older
 * or outside picture) is scaled down to this, which keeps the canvas, its undo history and the export small.
 */
export const WORKING_SIDE = 2560;
/** The server's limits for a picture: 10 MB, 8192 px per side, 16 megapixels. */
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_SIDE = 8192;
export const MAX_PIXELS = 16_000_000;
/**
 * What a picture put into the picture may be before it is opened at all: a file this big would take hundreds of MB
 * once decoded, so it is refused from its header, honestly, instead of freezing the tab.
 */
export const ADD_MAX_BYTES = 30 * 1024 * 1024;
export const ADD_MAX_SIDE = 12_000;
export const ADD_MAX_PIXELS = 50_000_000;
/** The saved picture: a JPEG like every stored picture (the server keeps JPEG), at the pipeline's own quality. */
export const SAVE_QUALITY = 0.92;

export const tooBig = (width: number, height: number) => width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS;

const canvasOf = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
};

const blobOf = (canvas: HTMLCanvasElement, type = 'image/png', quality?: number) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The picture could not be made.')), type, quality));

/** A canvas gives its memory back at once when it has no pixels left. */
export const free = (canvas: HTMLCanvasElement) => { canvas.width = 0; canvas.height = 0; };

/** Mosaic blocks scale with the picture (about 1/50 of its longer side, at least 12 px). */
export const blockSize = (width: number, height: number) => Math.max(12, Math.round(Math.max(width, height) / 50));

/** How much of the blur shows at a mask pixel: anything painted (whatever the brush's colour) fully; only the soft edge fades. */
export const maskAlpha = (red: number, green: number, blue: number) => Math.min(255, Math.max(red, green, blue) * 4);

export interface Box { left: number; top: number; right: number; bottom: number }
/** Where a set of brush strokes reaches, their width included. */
export function boundsOf(paths: { points?: number[]; strokeWidth?: number }[]): Box | null {
    let box: Box | null = null;
    for (const path of paths) {
        const points = path.points ?? [];
        const half = (path.strokeWidth ?? 0) / 2;
        for (let i = 0; i + 1 < points.length; i += 2) {
            const [x, y] = [points[i], points[i + 1]];
            box = box ? { left: Math.min(box.left, x - half), top: Math.min(box.top, y - half), right: Math.max(box.right, x + half), bottom: Math.max(box.bottom, y + half) }
                : { left: x - half, top: y - half, right: x + half, bottom: y + half };
        }
    }
    return box;
}
export const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * A picture's width and height from its first bytes (PNG, JPEG, GIF, WebP), without decoding it; null when the header
 * says nothing we know.
 */
export async function imageSize(blob: Blob): Promise<{ width: number; height: number } | null> {
    const bytes = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer());
    const view = new DataView(bytes.buffer);
    const at = (offset: number, text: string) => [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
    if (bytes.length >= 24 && at(1, 'PNG')) return { width: view.getUint32(16), height: view.getUint32(20) };
    if (bytes.length >= 10 && at(0, 'GIF8')) return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    if (bytes.length >= 30 && at(0, 'RIFF') && at(8, 'WEBP')) {
        if (at(12, 'VP8X')) return { width: 1 + (bytes[24] | bytes[25] << 8 | bytes[26] << 16), height: 1 + (bytes[27] | bytes[28] << 8 | bytes[29] << 16) };
        if (at(12, 'VP8L')) { const bits = view.getUint32(21, true); return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }; }
        if (at(12, 'VP8 ')) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
        return null;
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        for (let offset = 2; offset + 9 < bytes.length;) {
            if (bytes[offset] !== 0xff) return null;
            const marker = bytes[offset + 1];
            const length = view.getUint16(offset + 2);
            // Start-of-frame markers (baseline, progressive, …), not DHT/JPG/DAC.
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
            offset += 2 + length;
        }
    }
    return null;
}

/** Why a picture cannot be put into the picture, or null when it can. */
export function refusalOf(size: number, dimensions: { width: number; height: number } | null) {
    if (size > ADD_MAX_BYTES) return 'bytes' as const;
    if (dimensions && (dimensions.width > ADD_MAX_SIDE || dimensions.height > ADD_MAX_SIDE || dimensions.width * dimensions.height > ADD_MAX_PIXELS)) return 'pixels' as const;
    return null;
}

/** A picture too large to put into the picture, refused before it is opened. */
export class TooLargeToAdd extends Error {}

export class EditorImages {
    private urls = new Set<string>();
    private closed = false;

    /** A decoded picture from bytes, scaled to fit `side` if it is larger. */
    async fromBlob(blob: Blob, side = WORKING_SIDE): Promise<HTMLImageElement> {
        const image = await this.decode(this.track(URL.createObjectURL(blob)));
        return this.fit(image, side);
    }

    /**
     * A picture someone puts into the picture: refused from its header when it is too large to open, else decoded
     * straight at the size it will be used (the browser scales while decoding, so a big photo never sits in memory
     * at full size), at most `side` on its longest side.
     */
    async fromAddedBlob(blob: Blob, side: number): Promise<HTMLImageElement> {
        const dimensions = await imageSize(blob);
        if (refusalOf(blob.size, dimensions)) throw new TooLargeToAdd();
        const scale = dimensions ? Math.min(1, side / Math.max(dimensions.width, dimensions.height)) : 1;
        if (dimensions && scale < 1 && typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(blob, { resizeWidth: Math.round(dimensions.width * scale), resizeHeight: Math.round(dimensions.height * scale), resizeQuality: 'high' });
            const canvas = canvasOf(bitmap.width, bitmap.height);
            try { canvas.getContext('2d')?.drawImage(bitmap, 0, 0); }
            finally { bitmap.close(); }
            return this.fromCanvas(canvas);
        }
        return this.fromBlob(blob, side);
    }

    /** The same picture, at most `side` px on its longest side. */
    async fit(image: HTMLImageElement, side: number): Promise<HTMLImageElement> {
        const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
        if (scale === 1) return image;
        const canvas = canvasOf(image.naturalWidth * scale, image.naturalHeight * scale);
        const paint = canvas.getContext('2d');
        if (!paint) throw new Error('No canvas.');
        paint.imageSmoothingQuality = 'high';
        paint.drawImage(image, 0, 0, canvas.width, canvas.height);
        this.forget(image);
        return this.fromCanvas(canvas);
    }

    /** A canvas as a picture; the canvas is freed. */
    async fromCanvas(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
        try { return await this.decode(this.track(URL.createObjectURL(await blobOf(canvas)))); }
        finally { free(canvas); }
    }

    /**
     * `source` (the picture with everything beneath the blur flattened into it) with what is painted in `mask` (paint
     * on black, the same size) made unreadable: a coarse mosaic, softened. The result is a new picture; the source
     * and the mask are freed.
     */
    async blur(source: HTMLCanvasElement, mask: HTMLCanvasElement): Promise<HTMLImageElement> {
        const { width, height } = source;
        const block = blockSize(width, height);
        const small = canvasOf(width / block, height / block);
        const blurred = canvasOf(width, height);
        try {
            const tiny = small.getContext('2d'), wide = blurred.getContext('2d'), result = source.getContext('2d');
            const shape = mask.getContext('2d', { willReadFrequently: true });
            if (!tiny || !wide || !result || !shape) throw new Error('No canvas.');
            tiny.drawImage(source, 0, 0, small.width, small.height);
            wide.imageSmoothingEnabled = false;
            wide.filter = `blur(${Math.round(block / 2)}px)`;
            wide.drawImage(small, 0, 0, width, height);
            wide.filter = 'none';
            const pixels = shape.getImageData(0, 0, mask.width, mask.height);
            const data = pixels.data;
            for (let i = 0; i < data.length; i += 4) data[i + 3] = maskAlpha(data[i], data[i + 1], data[i + 2]);
            shape.putImageData(pixels, 0, 0);
            wide.globalCompositeOperation = 'destination-in';
            wide.imageSmoothingEnabled = true;
            wide.drawImage(mask, 0, 0, width, height);
            result.drawImage(blurred, 0, 0);
            return await this.fromCanvas(source);
        } finally {
            free(small); free(blurred); free(mask);
        }
    }

    /** Lets go of every picture made here. Pictures still on screen keep working until they are dropped. */
    release() {
        this.closed = true;
        for (const url of this.urls) URL.revokeObjectURL(url);
        this.urls.clear();
    }

    private track(url: string) {
        if (this.closed) { URL.revokeObjectURL(url); throw new Error('The editor was closed.'); }
        this.urls.add(url);
        return url;
    }

    private forget(image: HTMLImageElement) {
        if (this.urls.delete(image.src)) URL.revokeObjectURL(image.src);
    }

    private async decode(url: string) {
        const image = new Image();
        image.decoding = 'async';
        image.src = url;
        await image.decode();
        return image;
    }
}

/**
 * The edited picture as a file the server accepts: a JPEG like the original, at the pipeline's own quality, so its
 * size stays close to the original's (a PNG of a photo is several times larger and the server makes a JPEG of it
 * anyway, transparency included, so nothing is gained). Anything transparent is laid on white rather than black. A
 * picture over the byte limit tries a lower quality once; over the pixel limits it is refused. The canvas is freed.
 */
export async function fileOf(canvas: HTMLCanvasElement, name: string) {
    let flat: HTMLCanvasElement | null = null;
    try {
        if (tooBig(canvas.width, canvas.height)) throw new TooBig();
        flat = canvasOf(canvas.width, canvas.height);
        const paint = flat.getContext('2d');
        if (!paint) throw new Error('No canvas.');
        paint.fillStyle = 'white';
        paint.fillRect(0, 0, flat.width, flat.height);
        paint.drawImage(canvas, 0, 0);
        let blob = await blobOf(flat, 'image/jpeg', SAVE_QUALITY);
        if (blob.size > MAX_BYTES) blob = await blobOf(flat, 'image/jpeg', 0.8);
        if (blob.size > MAX_BYTES) throw new TooBig();
        return { blob, name: `${name}-edited.jpg` };
    } finally {
        free(canvas);
        if (flat) free(flat);
    }
}

/** Over the server's limits: too many pixels or bytes. */
export class TooBig extends Error {}
