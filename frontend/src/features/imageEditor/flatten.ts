import Konva from 'konva';
import { overlaps, type Box } from './editorImages';

/** A drawing on the picture as the library holds it: a Konva node in its design layer, by annotation id. */
interface DesignLayer { findOne: (selector: string) => Konva.Node | undefined }

/**
 * The picture with every drawing, text and pasted picture beneath a blur drawn into it, in the picture's own pixels:
 * the space the library builds the blur's mask in, so the blur then hides all of them, not only the photo under them.
 * A drawing counts as beneath when its box meets the painted area's box (`box`); null means every drawing. Gives the
 * flattened canvas (for the blur to change and free) and the drawings baked into it, which the caller then hides.
 */
export function flattenUnder(source: HTMLImageElement, layer: DesignLayer, annotationIds: string[], box: Box | null) {
    const width = source.naturalWidth || source.width, height = source.naturalHeight || source.height;
    const stage = new Konva.Stage({ container: document.createElement('div'), width, height, listening: false });
    try {
        const flat = new Konva.Layer({ listening: false });
        stage.add(flat);
        flat.add(new Konva.Image({ image: source, x: 0, y: 0, width, height }));
        const baked: string[] = [];
        for (const id of annotationIds) {
            const node = layer.findOne(`#${id}`);
            if (!node || !node.isVisible()) continue;
            // In the space of the group the drawing sits in: the picture's pixels. The layer above it is scaled by the zoom.
            const rect = node.getClientRect({ relativeTo: node.getParent() ?? undefined });
            if (box && !overlaps(box, { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height })) continue;
            flat.add(node.clone({ draggable: false, listening: false }) as Konva.Shape);
            baked.push(id);
        }
        const canvas = flat.toCanvas({ x: 0, y: 0, width, height, pixelRatio: 1 });
        return { canvas, baked };
    } finally {
        stage.destroy();
    }
}
