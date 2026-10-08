import { visualColors } from '../styles/visualColors';
export type PixelCrop = { x: number; y: number; width: number; height: number };
export const CROP_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;

// Inspect compressed headers before the browser decodes the image. Never allocate
// a canvas from untrusted source dimensions or crop coordinates.
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
    if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && ascii(12, 4) === 'IHDR') {
        return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
        const kind = ascii(12, 4);
        if (kind === 'VP8X') return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
        if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
        if (kind === 'VP8L' && bytes[20] === 0x2f) return { width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0xf) << 10) | (bytes[23] << 2) | (bytes[22] >> 6)) };
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 3 < bytes.length) {
            if (bytes[offset++] !== 0xff) break;
            while (bytes[offset] === 0xff) offset++;
            const marker = bytes[offset++];
            if (marker === 0xd9 || marker === 0xda) break;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
            if (offset + 2 > bytes.length) break;
            const length = view.getUint16(offset);
            if (length < 2 || offset + length > bytes.length) break;
            if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
                return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
            }
            offset += length;
        }
    }
    throw new Error('This image could not be read. Choose a JPEG, PNG or WebP photo.');
}

export function validateImageDimensions(width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > MAX_PIXELS) {
        throw new Error('Choose a photo up to 8192 pixels per side and 16 megapixels.');
    }
}

export async function prepareCropSource(file: File): Promise<string> {
    if (!CROP_IMAGE_ACCEPT.split(',').includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
    if (!file.size || file.size > MAX_BYTES) throw new Error('Choose a photo between 1 byte and 10 MB.');
    const { width, height } = imageDimensions(new Uint8Array(await file.arrayBuffer()));
    validateImageDimensions(width, height);
    return URL.createObjectURL(file);
}

export const createImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => finish(new Error('The image took too long to load. Please choose it again.')), 20000);
    function finish(error?: Error) {
        window.clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        if (error) { image.src = ''; reject(error); } else resolve(image);
    }
    image.onload = () => {
        try { validateImageDimensions(image.naturalWidth, image.naturalHeight); finish(); }
        catch (error) { finish(error as Error); }
    };
    image.onerror = () => finish(new Error('This photo could not be read. Choose another image.'));
    image.crossOrigin = 'anonymous';
    image.src = url;
});

export async function getCroppedImg(imageSrc: string, pixelCrop: PixelCrop, fileName = 'cropped.jpg', maxDimension = 1920): Promise<File> {
    if (!Object.values(pixelCrop).every(Number.isFinite) || pixelCrop.width <= 0 || pixelCrop.height <= 0 || !Number.isFinite(maxDimension) || maxDimension < 1) throw new Error('Choose a valid crop.');
    const image = await createImage(imageSrc);
    const x = Math.max(0, Math.min(pixelCrop.x, image.naturalWidth - 1));
    const y = Math.max(0, Math.min(pixelCrop.y, image.naturalHeight - 1));
    const width = Math.min(pixelCrop.width, image.naturalWidth - x);
    const height = Math.min(pixelCrop.height, image.naturalHeight - y);
    const scale = Math.min(1, Math.min(maxDimension, 1920) / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Your browser could not prepare this photo. Please try again.');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = visualColors.paper;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('This photo could not be prepared.')), 'image/jpeg', 0.94));
        return new File([blob], fileName, { type: 'image/jpeg' });
    } finally { canvas.width = 0; canvas.height = 0; }
}
