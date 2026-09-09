import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { subscribeNotificationsChanged } from './notifications';
beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => { vi.useRealTimers(); });
it('shares one bounded timer and pauses while hidden or offline', () => {
    const first = vi.fn(), second = vi.fn();
    const stopFirst = subscribeNotificationsChanged(first);
    const stopSecond = subscribeNotificationsChanged(second);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(30_000);
    expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    vi.advanceTimersByTime(60_000);
    expect(first).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(first).toHaveBeenCalledTimes(2);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    vi.advanceTimersByTime(30_000);
    expect(first).toHaveBeenCalledTimes(2);
    stopFirst(); stopFirst(); stopSecond();
    expect(vi.getTimerCount()).toBe(0);
    window.dispatchEvent(new Event('focus'));
    expect(first).toHaveBeenCalledTimes(2);
});
