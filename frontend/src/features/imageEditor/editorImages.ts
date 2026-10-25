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
const free = (canvas: HTMLCanvasElement) => { canvas.width = 0; canvas.height = 0; };

export class EditorImages {
    private urls = new Set<string>();
    private closed = false;

    /** A decoded picture from bytes, scaled to fit `side` if it is larger. */
    async fromBlob(blob: Blob, side = WORKING_SIDE): Promise<HTMLImageElement> {
        const image = await this.decode(this.track(URL.createObjectURL(blob)));
        return this.fit(image, side);
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
     * The picture with what is painted in `mask` (paint on black, the picture's size) made unreadable: a coarse mosaic,
     * softened. Blocks scale with the picture (about 1/50 of its longer side, at least 12 px), so names and faces stay
     * unreadable whatever the picture's size. The result is a new picture; the source is not changed.
     */
    async blur(source: HTMLImageElement, mask: HTMLCanvasElement): Promise<HTMLImageElement> {
        const width = source.naturalWidth || source.width, height = source.naturalHeight || source.height;
        const block = Math.max(12, Math.round(Math.max(width, height) / 50));
        const small = canvasOf(width / block, height / block);
        const blurred = canvasOf(width, height);
        const out = canvasOf(width, height);
        try {
            const tiny = small.getContext('2d'), wide = blurred.getContext('2d'), result = out.getContext('2d');
            const shape = mask.getContext('2d', { willReadFrequently: true });
            if (!tiny || !wide || !result || !shape) throw new Error('No canvas.');
            tiny.drawImage(source, 0, 0, small.width, small.height);
            wide.imageSmoothingEnabled = false;
            wide.filter = `blur(${Math.round(block / 2)}px)`;
            wide.drawImage(small, 0, 0, width, height);
            wide.filter = 'none';
            // Anything painted (in whatever colour the brush uses) shows the blur fully; only the soft edge fades.
            const pixels = shape.getImageData(0, 0, mask.width, mask.height);
            const data = pixels.data;
            for (let i = 0; i < data.length; i += 4) data[i + 3] = Math.min(255, Math.max(data[i], data[i + 1], data[i + 2]) * 4);
            shape.putImageData(pixels, 0, 0);
            wide.globalCompositeOperation = 'destination-in';
            wide.imageSmoothingEnabled = true;
            wide.drawImage(mask, 0, 0, width, height);
            result.drawImage(source, 0, 0, width, height);
            result.drawImage(blurred, 0, 0);
            return await this.fromCanvas(out);
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
 * The edited picture as a file the server accepts. PNG first, so the only lossy step is the server's own JPEG; a PNG
 * over the byte limit (a large photo) goes as a high-quality JPEG instead. The canvas is freed.
 */
export async function fileOf(canvas: HTMLCanvasElement, name: string) {
    try {
        if (tooBig(canvas.width, canvas.height)) throw new TooBig();
        let blob = await blobOf(canvas, 'image/png');
        let extension = 'png';
        if (blob.size > MAX_BYTES - 64 * 1024) { blob = await blobOf(canvas, 'image/jpeg', 0.95); extension = 'jpg'; }
        if (blob.size > MAX_BYTES) throw new TooBig();
        return { blob, name: `${name}-edited.${extension}` };
    } finally {
        free(canvas);
    }
}

/** Over the server's limits: too many pixels or bytes. */
export class TooBig extends Error {}
