import Konva from 'konva';

/**
 * Small, contained adjustments to the editing library that its settings cannot make. Each finds its target by what it
 * says (our translation of it) or by the library's own id, never by position, so a library update cannot change the
 * wrong thing; tests guard the names they rely on.
 */

/** Where the library puts its menus, colour picker and confirmations: in <body>, outside our dialog. */
export const LIBRARY_POPUPS = '.SfxPopper-wrapper, .SfxModal-Wrapper, [class*="SfxDrawer"], [data-tippy-root]';

/**
 * Hides the library's Ellipse crop: it makes transparent corners that the server's JPEG cannot keep. The library has no
 * setting to leave one of its built-in crops out, so its menu item is found by its label (ours: `label`) and hidden.
 * Returns how many it hid.
 */
export function hideEllipseCrop(root: ParentNode, label: string) {
    let hidden = 0;
    for (const item of root.querySelectorAll<HTMLElement>('[data-testid="FIE-crop-preset-item"]')) {
        const text = item.querySelector('[data-testid="FIE-crop-preset-item-label"]')?.textContent?.trim();
        if (text !== label) continue;
        const row = item.closest<HTMLElement>('.SfxMenuItem-wrapper') ?? item;
        if (row.style.display !== 'none') { row.style.display = 'none'; hidden++; }
    }
    return hidden;
}

/** Keeps the Ellipse crop hidden whenever the library opens its crop menu, until the returned stop is called. */
export function keepEllipseCropHidden(label: string) {
    if (typeof MutationObserver === 'undefined') return () => undefined;
    const observer = new MutationObserver(records => {
        if (records.some(record => record.addedNodes.length > 0)) hideEllipseCrop(document, label);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
}

/** The library's photo node: the picture being edited, beneath every drawing. */
export const PHOTO_NODE_ID = 'FIE_original-image';

/**
 * Whether the library inside `root` has its photo yet. It loads the photo itself, about a second after it is on screen
 * at a phone's speed; anything put into its state before then is lost, and a save would read an empty picture.
 */
export function libraryShowsPhoto(root: Element | null) {
    const stage = root ? Konva.stages?.find(each => root.contains(each.container())) : undefined;
    return Boolean(stage?.findOne(`#${PHOTO_NODE_ID}`));
}

/**
 * Runs the library's save (`read`) without it caching the photo first. The library caches the photo only to apply
 * filters, which this editor does not offer, and that cache is drawn at the photo's on-screen size and rounded up, then
 * scaled back to the picture's own size: every saved photo came out softer than the original (at a phone's width, a
 * third of its resolution). Without it the photo is drawn straight from its own pixels. Only the photo, only while it
 * has no filters, and only during this one synchronous call; Konva is left as it was.
 */
export function withoutPhotoCache<T>(read: () => T): T {
    const images = Konva.Image.prototype as { cache?: unknown };
    const own = Object.getOwnPropertyDescriptor(images, 'cache');
    const inherited = (Object.getPrototypeOf(images) as Konva.Node).cache;
    function cache(this: Konva.Image, ...args: Parameters<Konva.Node['cache']>) {
        return this.id() === PHOTO_NODE_ID && !this.filters()?.length ? this : inherited.apply(this, args);
    }
    Object.defineProperty(images, 'cache', { value: cache, configurable: true, writable: true });
    try {
        return read();
    } finally {
        if (own) Object.defineProperty(images, 'cache', own);
        else delete images.cache;
    }
}
