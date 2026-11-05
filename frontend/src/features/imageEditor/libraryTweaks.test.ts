import { describe, expect, it, vi } from 'vitest';
import css from './image-editor.css?raw';
import { arrowHeads, drawingKind, grabs, toolInHand } from './libraryTweaks';

vi.mock('konva', () => ({ default: {} }));

describe('picking a drawing up again', () => {
    it('knows the drawings by the ids the library gives them', () => {
        expect(['Rect-12', 'Arrow-3', 'Pen-4', 'Text-5', 'Image-6ab'].map(drawingKind)).toEqual(['Rect', 'Arrow', 'Pen', 'Text', 'Image']);
        expect(drawingKind('FIE_original-image')).toBeNull();
        expect(drawingKind('watermark')).toBeNull();
    });

    it('picks up what is pressed on instead of drawing a new one over it; the pen always draws; a pasted picture is drawn on', () => {
        // With a box, an arrow or a text in hand, any drawing is picked up (the library drew a second one over it).
        for (const tool of ['rect', 'arrow', 'text']) for (const kind of ['Rect', 'Arrow', 'Pen', 'Text']) expect(grabs(tool, kind)).toBe(true);
        // A pasted screenshot is annotated, not dragged, unless no drawing tool is in hand.
        expect(grabs('arrow', 'Image')).toBe(false);
        expect(grabs('', 'Image')).toBe(true);
        expect(grabs('pen', 'Rect')).toBe(false);
        // Outside the drawing tools (crop, rotate, blur) nothing is picked up; nor the photo itself.
        expect(grabs(null, 'Rect')).toBe(false);
        expect(grabs('rect', null)).toBe(false);
    });

    it('reads the tool in hand from the library’s toolbar', () => {
        const bar = (selected: string | null) => {
            const root = document.createElement('div');
            for (const name of ['pen', 'arrow', 'rect', 'text']) {
                const button = document.createElement('div');
                button.dataset.testid = `FIE-tools-bar-item-button-${name}`;
                button.setAttribute('aria-selected', String(name === selected));
                root.append(button);
            }
            return root;
        };
        expect(toolInHand(bar('rect'))).toBe('rect');
        expect(toolInHand(bar(null))).toBe('');
        expect(toolInHand(document.createElement('div'))).toBeNull();
    });
});

describe('an arrow given a new colour', () => {
    it('gets it on its head too, not only its line', () => {
        expect(arrowHeads({ 'Arrow-1': { name: 'Arrow', stroke: '#1e88e5', fill: '#c22f45' }, 'Rect-2': { name: 'Rect', stroke: '#1e88e5', fill: 'transparent' } }))
            .toEqual({ 'Arrow-1': { fill: '#1e88e5' } });
        expect(arrowHeads({ 'Arrow-1': { name: 'Arrow', stroke: '#1e88e5', fill: '#1e88e5' } })).toBeNull();
        expect(arrowHeads(undefined)).toBeNull();
    });
});

describe('the library’s pop-ups above the editor', () => {
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .map(([, selectors, body]) => ({ selectors: selectors.split(',').map(each => each.trim()), body }));
    const level = (selector: string) => {
        const rule = rules.find(each => each.selectors.includes(selector));
        return rule ? Number(/z-index:\s*(-?\d+)/.exec(rule.body)?.[1]) : NaN;
    };

    it('keeps the library’s own order: a pop-over, the colour picker over it, the Hex/RGB list over that', () => {
        const popover = level('.SfxPopper-wrapper'), picker = level('.SfxModal-Wrapper'), list = level('.SfxPopper-wrapper:has(.SfxSelect-tickIcon)');
        expect(popover).toBeGreaterThan(level('.gk.ie-layer'));
        expect(picker).toBeGreaterThan(popover);
        expect(list).toBeGreaterThan(picker);
    });

    it('never lifts a modal’s overlay over its own colour picker, nor the drawer inside the editor', () => {
        expect(rules.flatMap(rule => rule.selectors).filter(selector => /SfxModal-Overlay|SfxDrawer/.test(selector))).toEqual([]);
    });
});
