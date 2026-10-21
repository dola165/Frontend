import { imageDimensions, prepareCropSource, getCroppedImg } from '../cropImageHelper';
const png = (width: number, height: number) => {
    const bytes = new Uint8Array(24), view = new DataView(bytes.buffer);
    view.setUint32(0, 0x89504e47); bytes.set([73, 72, 68, 82], 12); view.setUint32(16, width); view.setUint32(20, height);
    return bytes;
};
it('reads JPEG and PNG dimensions without decoding', () => {
    expect(imageDimensions(png(6000, 2000))).toEqual({ width: 6000, height: 2000 });
    expect(imageDimensions(new Uint8Array([255,216,255,192,0,7,8,1,144,3,32]))).toEqual({ width: 800, height: 400 });
});
it('rejects excessive dimensions and malformed images before allocating an object URL', async () => {
    URL.createObjectURL = vi.fn();
    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => png(8000, 8000).buffer });
    await expect(prepareCropSource(file)).rejects.toThrow('16 megapixels');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(() => imageDimensions(new Uint8Array([1,2,3]))).toThrow('could not be read');
});
it('bounds output resolution, preserves quality, fills transparent areas and releases the canvas', async () => {
    const originalImage = globalThis.Image;
    class LoadedImage { naturalWidth = 6000; naturalHeight = 2000; onload: (() => void) | null = null; onerror = null; crossOrigin = ''; set src(_value: string) { queueMicrotask(() => this.onload?.()); } }
    vi.stubGlobal('Image', LoadedImage);
    const ctx = { drawImage: vi.fn(), fillRect: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: '', fillStyle: '' };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: vi.fn((done: (blob: Blob) => void) => done(new Blob(['jpg']))) };
    const create = vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
    try {
        const file = await getCroppedImg('blob:photo', { x: 0, y: 0, width: 6000, height: 2000 });
        expect(file.type).toBe('image/jpeg');
        expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 6000, 2000, 0, 0, 1920, 640);
        expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.94);
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 640);
        expect(canvas.width).toBe(0);
    } finally { create.mockRestore(); vi.stubGlobal('Image', originalImage); }
});
it('rejects nonfinite crop input before decoding', async () => {
    await expect(getCroppedImg('blob:photo', { x: NaN, y: 0, width: 1, height: 1 })).rejects.toThrow('valid crop');
});
