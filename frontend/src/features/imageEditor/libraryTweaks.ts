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

/** The library's stage inside `root` (the one on screen), if it has one. */
export const editorStage = (root: Element | null) => (root ? Konva.stages?.find(each => root.contains(each.container())) : undefined);

/** The library's photo node: the picture being edited, beneath every drawing. */
export const PHOTO_NODE_ID = 'FIE_original-image';

/**
 * Whether the library inside `root` has its photo yet. It loads the photo itself, about a second after it is on screen
 * at a phone's speed; anything put into its state before then is lost, and a save would read an empty picture.
 */
export function libraryShowsPhoto(root: Element | null) {
    return Boolean(editorStage(root)?.findOne(`#${PHOTO_NODE_ID}`));
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


/**
 * The drawing tool in hand, by the library's own toolbar: `pen`, `arrow`, `rect` or `text`; '' when the drawing tools
 * show but none is chosen (a picture just put in); null outside them (crop, rotate, blur).
 */
export function toolInHand(root: ParentNode): string | null {
    if (!root.querySelector('[data-testid="FIE-tools-bar-item-button-pen"]')) return null;
    const chosen = root.querySelector('[data-testid^="FIE-tools-bar-item-button-"][aria-selected="true"]');
    return chosen?.getAttribute('data-testid')?.replace('FIE-tools-bar-item-button-', '') ?? '';
}

/** What a drawing on the picture is, by the id the library gives it (`Rect-…`, a pen stroke `Pen-…`), or null. */
export const drawingKind = (id: string) => /^(Rect|Arrow|Pen|Text|Image)-/.exec(id)?.[1] ?? null;

/**
 * Whether pressing on a drawing picks it up (to move it, its handles shown) rather than drawing a new one over it, which
 * is what the library does with a drawing tool in hand. The pen always draws (strokes cross each other); a picture put
 * in is drawn on (an arrow onto a pasted screenshot) unless no tool is in hand; everything else is picked up. A click
 * selects any drawing, as before.
 */
export function grabs(tool: string | null, kind: string | null) {
    if (tool === null || tool === 'pen' || kind === null) return false;
    return kind !== 'Image' || tool === '';
}

const TEXT_SIZE = { width: 240, height: 64 };

/**
 * Makes the drawings behave as people expect, on the library's own stage and events:
 * - pressing on a drawing picks it up and selects it (see {@link grabs}), so a box, an arrow or a pasted picture can be
 *   moved and sized again after something else was chosen;
 * - with Text in hand, a click puts a text there (the library wants a drag), and a new text opens for typing at once,
 *   its placeholder selected so the first key replaces it; a click beside it then ends the typing (no second text).
 * Returns the way to undo it all.
 */
export function friendlierDrawing(stage: Konva.Stage, root: Element, select: (id: string, kind: string) => void) {
    const content = stage.content;
    let press: { x: number; y: number; texts: Set<string> } | null = null;
    let timer = 0;
    const texts = () => new Set(stage.find((node: Konva.Node) => drawingKind(node.id()) === 'Text').map(node => node.id()));
    const drawingAt = () => {
        const point = stage.getPointerPosition();
        for (let node: Konva.Node | null = point ? stage.getIntersection(point) : null; node && node !== stage; node = node.getParent()) {
            if (drawingKind(node.id())) return node;
        }
        return null;
    };
    const down = (event: PointerEvent) => {
        press = null;
        if (!event.isPrimary || event.button > 0) return;
        stage.setPointersPositions(event);
        const tool = toolInHand(root);
        const node = drawingAt();
        const kind = node && drawingKind(node.id());
        if (node && kind && grabs(tool, kind)) {
            if (!node.draggable()) { node.draggable(true); select(node.id(), kind); }
            return;
        }
        // A click while a text is open for typing only ends the typing.
        const typing = root.querySelector('[contenteditable="true"]');
        if (tool === 'text' && !node && !typing) press = { x: event.clientX, y: event.clientY, texts: texts() };
    };
    const typeInto = (before: Set<string>, tries = 0) => {
        const isNew = (node: Konva.Node) => drawingKind(node.id()) === 'Text' && !before.has(node.id());
        const transformer = (stage.find('Transformer') as Konva.Transformer[]).find(each => each.nodes().some(isNew));
        if (!transformer) { if (tries < 20) timer = window.setTimeout(() => typeInto(before, tries + 1), 25); return; }
        transformer.fire('dblclick');
        const caret = (left = 20) => {
            const box = root.querySelector<HTMLElement>('[contenteditable="true"]');
            if (!box) { if (left > 0) timer = window.setTimeout(() => caret(left - 1), 25); return; }
            box.focus();
            window.getSelection()?.selectAllChildren(box);
        };
        caret();
    };
    const up = (event: PointerEvent) => {
        const started = press;
        press = null;
        if (!started || !event.isPrimary) return;
        // A click, not a drag: the library's own drawing is given a text's size before it sees the release.
        if (Math.hypot(event.clientX - started.x, event.clientY - started.y) < 10) {
            content.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true, clientX: started.x + TEXT_SIZE.width, clientY: started.y + TEXT_SIZE.height,
            }));
        }
        typeInto(started.texts);
    };
    content.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    return () => {
        window.clearTimeout(timer);
        content.removeEventListener('pointerdown', down, true);
        document.removeEventListener('pointerup', up, true);
    };
}

/**
 * Arrows whose head is not the colour of their line (the library's colour option changes only the line), with the
 * change that puts it right; null when every arrow is one colour.
 */
export function arrowHeads(annotations: Record<string, { name?: string; stroke?: string; fill?: string }> | undefined) {
    const fixes = Object.entries(annotations ?? {})
        .filter(([, mark]) => mark.name === 'Arrow' && mark.stroke && mark.fill !== mark.stroke)
        .map(([id, mark]) => [id, { fill: mark.stroke }] as const);
    return fixes.length ? Object.fromEntries(fixes) : null;
}
