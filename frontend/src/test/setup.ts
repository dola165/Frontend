import '@testing-library/jest-dom/vitest';

// jsdom has no scrolling layout. Browser regressions verify actual positioning.
Element.prototype.scrollTo = function (options?: ScrollToOptions | number, y?: number) {
    this.scrollTop = typeof options === 'number' ? y ?? 0 : options?.top ?? this.scrollTop;
};

// jsdom keeps the `inert` attribute but has no `inert` property. Browsers reflect one into the other.
if (!('inert' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'inert', {
        configurable: true,
        get(this: HTMLElement) { return this.hasAttribute('inert'); },
        set(this: HTMLElement, value: unknown) { this.toggleAttribute('inert', Boolean(value)); },
    });
}
