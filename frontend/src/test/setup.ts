import '@testing-library/jest-dom/vitest';

// jsdom has no scrolling layout. Browser regressions verify actual positioning.
Element.prototype.scrollTo = function (options?: ScrollToOptions | number, y?: number) {
    this.scrollTop = typeof options === 'number' ? y ?? 0 : options?.top ?? this.scrollTop;
};
