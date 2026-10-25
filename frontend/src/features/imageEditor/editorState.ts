/** The part of the editing library's state we touch: adding a picture into the picture. */
export interface EditorState {
    annotationIds: string[];
    annotations: Record<string, unknown>;
    selectionsIds: string[];
    originalSource: { width: number; height: number };
    shownImageDimensions: { originalSourceInitialScale?: number };
    adjustments: { crop?: { x?: number; y?: number; width?: number; height?: number } };
    isDesignState?: boolean;
    tabId?: string;
    toolId?: string;
}

/**
 * A picture put into the picture, centred in what is shown (after a crop) and at most 70% of it, selected so it can
 * be moved and sized at once. As a design change, so Undo takes it out again.
 */
export function addPicture(state: EditorState, picture: HTMLImageElement): Partial<EditorState> {
    const scale = state.shownImageDimensions.originalSourceInitialScale || 1;
    const crop = state.adjustments.crop ?? {};
    const width = (crop.width ?? 0) / scale || state.originalSource.width;
    const height = (crop.height ?? 0) / scale || state.originalSource.height;
    const left = (crop.x ?? 0) / scale, top = (crop.y ?? 0) / scale;
    const fit = Math.min(1, (width * 0.7) / picture.naturalWidth, (height * 0.7) / picture.naturalHeight);
    const id = `Image-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const shown = { width: picture.naturalWidth * fit, height: picture.naturalHeight * fit };
    return {
        isDesignState: true,
        annotationIds: [...state.annotationIds, id],
        annotations: { [id]: { id, name: 'Image', image: picture, x: left + (width - shown.width) / 2, y: top + (height - shown.height) / 2, ...shown, opacity: 1 } },
        selectionsIds: [id],
        tabId: 'Annotate',
        toolId: 'Image',
    };
}
