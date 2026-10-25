import { expect, it, vi } from 'vitest';
import { flattenUnder } from './flatten';
// The library's internals have no types; this reads the crop choices it builds in.
// @ts-expect-error untyped library internals
import { DEFAULT_CROP_PRESETS } from 'react-filerobot-image-editor/lib/components/tools/Crop/Crop.constants';
import Konva from 'konva';
// @ts-expect-error untyped library internals
import { IMAGE_NODE_ID } from 'react-filerobot-image-editor/lib/utils/constants';
import { PHOTO_NODE_ID, hideEllipseCrop, libraryShowsPhoto, withoutPhotoCache } from './libraryTweaks';

// Konva draws on a real canvas jsdom does not have; a stand-in records what goes into the flattened picture.
const drawn = vi.hoisted(() => ({ nodes: [] as unknown[], destroyed: 0, cached: [] as string[], stages: [] as unknown[] }));
vi.mock('konva', () => {
    class Layer { add(node: unknown) { drawn.nodes.push(node); return this; } toCanvas() { return { width: 1280, height: 800 }; } }
    class Stage { add() { return this; } destroy() { drawn.destroyed++; } }
    class Shape { id() { return ''; } cache() { drawn.cached.push(this.id()); return this; } }
    class Image extends Shape { attrs: unknown; constructor(attrs: unknown) { super(); this.attrs = attrs; } }
    return { default: { Stage, Layer, Image, stages: drawn.stages } };
});

const zoomedGroup = { scale: 0.3 };
const node = (id: string, x: number, y: number, width: number, height: number, visible = true) => ({
    id, isVisible: () => visible, getParent: () => zoomedGroup,
    // Measured in the group the drawings sit in (the picture's pixels), never in the layer the zoom scales.
    getClientRect: ({ relativeTo }: { relativeTo?: unknown }) => relativeTo === zoomedGroup ? { x, y, width, height } : { x: x * 0.3, y: y * 0.3, width: width * 0.3, height: height * 0.3 },
    clone: () => ({ clonedFrom: id }),
});

it('draws into the picture every drawing beneath the blurred area, and only those', () => {
    drawn.nodes = [];
    const nodes = { arrow: node('arrow', 100, 100, 50, 50), text: node('text', 900, 600, 200, 40), pasted: node('pasted', 40, 40, 300, 300), hidden: node('hidden', 100, 100, 10, 10, false) };
    const layer = { findOne: (selector: string) => nodes[selector.slice(1) as keyof typeof nodes] };
    const source = { naturalWidth: 1280, naturalHeight: 800 } as HTMLImageElement;
    const { canvas, baked } = flattenUnder(source, layer as never, ['arrow', 'text', 'pasted', 'hidden', 'gone'], { left: 80, top: 80, right: 220, bottom: 220 });
    expect(baked).toEqual(['arrow', 'pasted']);
    expect(drawn.nodes).toHaveLength(3); // the photo, then the two drawings beneath
    expect(drawn.nodes.slice(1)).toEqual([{ clonedFrom: 'arrow' }, { clonedFrom: 'pasted' }]);
    expect(canvas).toEqual({ width: 1280, height: 800 });
    expect(drawn.destroyed).toBeGreaterThan(0);
});

it('hides the Ellipse crop by its label, never by its place in the menu', () => {
    document.body.innerHTML = ['Free', 'Original', 'Square', 'Ellipse', 'Landscape'].map(label =>
        `<div class="SfxMenuItem-wrapper"><div data-testid="FIE-crop-preset-item"><span data-testid="FIE-crop-preset-item-label">${label}</span></div></div>`).join('');
    expect(hideEllipseCrop(document, 'Ellipse')).toBe(1);
    const rows = [...document.querySelectorAll<HTMLElement>('.SfxMenuItem-wrapper')];
    expect(rows.map(row => row.style.display === 'none')).toEqual([false, false, false, true, false]);
    expect(hideEllipseCrop(document, 'Ellipse')).toBe(0);
});

it('guards the library update: its built-in crops still include the Ellipse we hide, under that name', () => {
    const keys = (DEFAULT_CROP_PRESETS as { titleKey: string }[]).map(preset => preset.titleKey);
    expect(keys).toContain('ellipse');
});

it('saves the photo straight from its own pixels: its cache is skipped during the save, and only then', () => {
    drawn.cached = [];
    const node = (id: string, filters: unknown[] = []) => Object.assign(new Konva.Image({} as never), { id: () => id, filters: () => filters });
    const photo = node(PHOTO_NODE_ID), pasted = node('Image-3'), filtered = node(PHOTO_NODE_ID, [{}]);
    expect(withoutPhotoCache(() => { photo.cache(); pasted.cache(); filtered.cache(); return 'read'; })).toBe('read');
    expect(drawn.cached).toEqual(['Image-3', PHOTO_NODE_ID]);
    expect(Object.prototype.hasOwnProperty.call(Konva.Image.prototype, 'cache')).toBe(false);
    photo.cache();
    expect(drawn.cached).toHaveLength(3);
    expect(() => withoutPhotoCache(() => { throw new Error('failed'); })).toThrow('failed');
    expect(Object.prototype.hasOwnProperty.call(Konva.Image.prototype, 'cache')).toBe(false);
});

it('guards the library update: its photo still has the id the save looks for', () => {
    expect(IMAGE_NODE_ID).toBe(PHOTO_NODE_ID);
});

it('knows when the library has loaded its photo inside the editor, and only that editor', () => {
    const dialog = document.createElement('section'), inside = dialog.appendChild(document.createElement('div'));
    const stage = (container: Element, photo: boolean) => ({ container: () => container, findOne: (selector: string) => photo && selector === '#' + PHOTO_NODE_ID ? {} : undefined });
    drawn.stages.splice(0, drawn.stages.length, stage(document.createElement('div'), true), stage(inside, false));
    expect(libraryShowsPhoto(dialog)).toBe(false);
    drawn.stages.splice(1, 1, stage(inside, true));
    expect(libraryShowsPhoto(dialog)).toBe(true);
    expect(libraryShowsPhoto(null)).toBe(false);
    drawn.stages.length = 0;
});
