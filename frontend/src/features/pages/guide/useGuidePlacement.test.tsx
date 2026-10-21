import { useRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGuidePlacement } from './useGuidePlacement';

let rectangles = new WeakMap<Element, DOMRect>();

function Card({ target }: { target?: string }) {
  const ref = useRef<HTMLElement>(null);
  const placement = useGuidePlacement(ref, target, true);
  return <section ref={ref} data-testid="card" data-inline={String(placement.inline)} data-obscured={String(placement.obscured)} data-top={placement.top} data-max-height={placement.maxHeight} />;
}
beforeEach(() => {
  rectangles = new WeakMap();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectangles.get(this) ?? (this.classList.contains('gk-dialog') ? new DOMRect(0, 0, 390, 740) : new DOMRect(0, 0, 344, 250));
  });
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return [this.getBoundingClientRect()] as unknown as DOMRectList;
  });
});
afterEach(() => { document.querySelectorAll('[data-fixture]').forEach(node => node.remove()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const modal = (className: string) => {
  const node = document.createElement('div'); node.className = className;
  node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true'); node.dataset.fixture = '';
  document.body.append(node); return node;
};
it('gives a narrow editor a separate guide row within available viewport height', async () => {
  modal('gk-dialog');
  render(<Card target=".gk-dialog" />);
  await waitFor(() => expect(screen.getByTestId('card')).toHaveAttribute('data-inline', 'true'));
  expect(Number(screen.getByTestId('card').dataset.maxHeight)).toBeLessThan(844 / 2);
  expect(screen.getByTestId('card')).toHaveAttribute('data-obscured', 'false');
});
it('yields to an unrelated dialog then returns without changing the task', async () => {
  render(<Card />);
  const account = modal('gk-sheet');
  await waitFor(() => expect(screen.getByTestId('card')).toHaveAttribute('data-obscured', 'true'));
  account.remove();
  await waitFor(() => expect(screen.getByTestId('card')).toHaveAttribute('data-obscured', 'false'));
});
it('keeps the entire guide above an actionable toast and returns after it leaves', async () => {
  vi.stubGlobal('innerWidth', 1920); vi.stubGlobal('innerHeight', 1080);
  render(<Card />);
  await waitFor(() => expect(Number(screen.getByTestId('card').dataset.top)).toBe(818));
  const toaster = document.createElement('ol'); toaster.dataset.sonnerToaster = ''; toaster.dataset.yPosition = 'bottom'; toaster.dataset.fixture = '';
  const toast = document.createElement('li'); toast.dataset.sonnerToast = ''; toast.dataset.visible = 'true';
  toast.textContent = 'Someone just changed this. Keep mine'; toaster.append(toast);
  rectangles.set(toaster, new DOMRect(1532, 956, 356, 96));
  rectangles.set(toast, new DOMRect(1532, 956, 356, 96));
  document.body.append(toaster);
  await waitFor(() => expect(Number(screen.getByTestId('card').dataset.top) + 250).toBeLessThanOrEqual(944));
  expect(screen.getByTestId('card')).toHaveAttribute('data-obscured', 'false');
  toaster.remove();
  await waitFor(() => expect(Number(screen.getByTestId('card').dataset.top)).toBe(818));
});
it('reserves the toast area for a narrow editor instead of covering its guide controls', async () => {
  const editor = modal('gk-dialog');
  const toaster = document.createElement('ol'); toaster.dataset.sonnerToaster = ''; toaster.dataset.yPosition = 'bottom'; toaster.dataset.fixture = '';
  const toast = document.createElement('li'); toast.dataset.sonnerToast = ''; toast.dataset.visible = 'true'; toaster.append(toast);
  rectangles.set(toaster, new DOMRect(16, 720, 358, 100));
  rectangles.set(toast, new DOMRect(16, 720, 358, 100));
  document.body.append(toaster);
  render(<Card target=".gk-dialog" />);
  await waitFor(() => expect(Number.parseFloat(editor.style.getPropertyValue('--gk-guide-viewport'))).toBeLessThanOrEqual(696));
  expect(screen.getByTestId('card')).toHaveAttribute('data-inline', 'true');
});
