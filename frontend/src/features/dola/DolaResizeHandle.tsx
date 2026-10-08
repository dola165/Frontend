import { useRef } from 'react';
import { useDola } from './DolaContext';

export function DolaResizeHandle() {
    const { panelSize } = useDola();
    const drag = useRef<{ x: number; width: number; pointer: number } | null>(null);
    if (!panelSize.resizable) return null;
    return <div className="dola-resize-handle" role="separator" tabIndex={0}
        aria-label="Resize Agent Dola" aria-orientation="vertical"
        aria-valuemin={panelSize.min} aria-valuemax={panelSize.max} aria-valuenow={panelSize.width}
        aria-valuetext={`${panelSize.width} pixels wide`}
        title="Drag to resize. Arrow keys adjust width; double-click or Enter resets."
        onPointerDown={event => {
            if (event.button !== 0) return;
            event.preventDefault(); event.currentTarget.focus();
            drag.current = { x: event.clientX, width: panelSize.width, pointer: event.pointerId };
            event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
            if (drag.current?.pointer === event.pointerId) panelSize.setWidth(drag.current.width + drag.current.x - event.clientX);
        }}
        onPointerUp={event => {
            drag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onDoubleClick={panelSize.reset}
        onKeyDown={event => {
            const step = event.shiftKey ? 40 : 20;
            if (event.key === 'ArrowLeft') panelSize.setWidth(panelSize.width + step);
            else if (event.key === 'ArrowRight') panelSize.setWidth(panelSize.width - step);
            else if (event.key === 'Home') panelSize.setWidth(panelSize.min);
            else if (event.key === 'End') panelSize.setWidth(panelSize.max);
            else if (event.key === 'Enter') panelSize.reset();
            else return;
            event.preventDefault();
        }}><span /></div>;
}
