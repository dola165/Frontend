import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ADD_MAX_BYTES, MAX_BYTES, SAVE_QUALITY, TooBig, blockSize, boundsOf, fileOf, imageSize, maskAlpha, overlaps, refusalOf } from './editorImages';

/** jsdom has no canvas: a stand-in that records what was drawn and what was asked of toBlob. */
const calls: { type?: string; quality?: number }[] = [];
let nextSizes: number[] = [];
beforeEach(() => {
    calls.length = 0;
    nextSizes = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, done: BlobCallback, type?: string, quality?: number) {
        calls.push({ type, quality });
        const size = nextSizes.shift() ?? 1000;
        done({ size, type: type ?? 'image/png' } as Blob);
    });
});
afterEach(() => { vi.restoreAllMocks(); });

const canvas = (width: number, height: number) => { const made = document.createElement('canvas'); made.width = width; made.height = height; return made; };

it('saves a JPEG at the pipeline’s quality, like the original, and frees the canvas', async () => {
    const source = canvas(1200, 796);
    const file = await fileOf(source, 'touchline');
    expect(file.name).toBe('touchline-edited.jpg');
    expect(calls).toEqual([{ type: 'image/jpeg', quality: SAVE_QUALITY }]);
    expect(source.width).toBe(0);
});

it('tries a lower quality once when the JPEG is over the byte limit, then refuses', async () => {
    nextSizes = [MAX_BYTES + 1, 4_000_000];
    await expect(fileOf(canvas(4000, 3000), 'big')).resolves.toMatchObject({ name: 'big-edited.jpg' });
    expect(calls.map(call => call.quality)).toEqual([SAVE_QUALITY, 0.8]);
    nextSizes = [MAX_BYTES + 1, MAX_BYTES + 1];
    await expect(fileOf(canvas(4000, 3000), 'huge')).rejects.toBeInstanceOf(TooBig);
});

it('refuses a canvas over the pixel limits before encoding it', async () => {
    await expect(fileOf(canvas(9000, 10), 'wide')).rejects.toBeInstanceOf(TooBig);
    await expect(fileOf(canvas(5000, 4000), 'many')).rejects.toBeInstanceOf(TooBig);
    expect(calls).toEqual([]);
});

it('blurs with blocks that grow with the picture, and anything painted hides fully', () => {
    expect(blockSize(400, 300)).toBe(12);
    expect(blockSize(1920, 1080)).toBe(38);
    expect(maskAlpha(0, 0, 0)).toBe(0);
    expect(maskAlpha(104, 121, 235)).toBe(255);
    expect(maskAlpha(10, 0, 0)).toBe(40);
});

it('knows where the strokes reach and which drawings lie beneath them', () => {
    const box = boundsOf([{ points: [100, 100, 200, 120], strokeWidth: 40 }, { points: [150, 300], strokeWidth: 20 }]);
    expect(box).toEqual({ left: 80, top: 80, right: 220, bottom: 310 });
    expect(boundsOf([])).toBeNull();
    expect(overlaps(box!, { left: 210, top: 0, right: 400, bottom: 90 })).toBe(true);
    expect(overlaps(box!, { left: 221, top: 0, right: 400, bottom: 400 })).toBe(false);
});

const bytes = (...parts: number[]) => new Blob([new Uint8Array(parts)]);
const ascii = (text: string) => [...text].map(char => char.charCodeAt(0));
const be32 = (n: number) => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];

it('reads a picture’s size from its header without opening it', async () => {
    expect(await imageSize(bytes(0x89, ...ascii('PNG'), 13, 10, 26, 10, 0, 0, 0, 13, ...ascii('IHDR'), ...be32(20000), ...be32(30000)))).toEqual({ width: 20000, height: 30000 });
    expect(await imageSize(bytes(...ascii('GIF89a'), 0x40, 0x01, 0xf0, 0x00))).toEqual({ width: 320, height: 240 });
    // JPEG: an APP0 segment, then a baseline frame of 4000 × 3000.
    expect(await imageSize(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x0b, 0xb8, 0x0f, 0xa0, 3))).toEqual({ width: 4000, height: 3000 });
    expect(await imageSize(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBPVP8X'), 0, 0, 0, 0, 0, 0, 0, 0, 0x7f, 0x0c, 0, 0x5f, 0x09, 0))).toEqual({ width: 3200, height: 2400 });
    expect(await imageSize(bytes(1, 2, 3))).toBeNull();
});

it('refuses a picture too large to put in, honestly, before decoding it', () => {
    expect(refusalOf(ADD_MAX_BYTES + 1, { width: 100, height: 100 })).toBe('bytes');
    expect(refusalOf(1000, { width: 20000, height: 30000 })).toBe('pixels');
    expect(refusalOf(1000, { width: 9000, height: 7000 })).toBe('pixels');
    expect(refusalOf(1000, { width: 4000, height: 3000 })).toBeNull();
    expect(refusalOf(1000, null)).toBeNull();
});
