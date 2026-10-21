import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LandingLightField } from './LandingLightField';

let callbacks: FrameRequestCallback[];
beforeEach(() => {
    callbacks = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('does no continuous frame work while idle and batches scrolling into one update', () => {
    const { container } = render(<div className="gk-landing"><LandingLightField paused={false}/></div>);
    expect(container.querySelector('canvas')).toBeNull();
    expect(callbacks).toHaveLength(1);
    callbacks[0](0);
    expect(callbacks).toHaveLength(1);
    for (let i = 0; i < 20; i++) fireEvent.scroll(window);
    expect(callbacks).toHaveLength(2);
    callbacks[1](16);
    expect(callbacks).toHaveLength(2);
});

it('stops listening and cancels scheduled work when the landing page unmounts', () => {
    const { unmount } = render(<div className="gk-landing"><LandingLightField paused={false}/></div>);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    fireEvent.scroll(window);
    expect(callbacks).toHaveLength(1);
});
