import { Eye } from 'lucide-react';
import { usePagesCopy } from '../copy';
import { usePageEdit } from './context';
import './edit.css';

/**
 * Where a new page's posts will be, while there are none: a dimmed picture of a finished page under one button,
 * so the owner sees what theirs can become and opens the live example with a tap.
 */
export function ExamplePreview() {
  const t = usePagesCopy();
  const { openPanel } = usePageEdit();
  return (
    <button type="button" className="gk-example-preview" onClick={() => openPanel('example')}>
      <img src="/examples/club-page.jpg" alt="" aria-hidden="true" />
      <span className="gk-example-preview__words"><Eye aria-hidden="true" />{t('What a finished club looks like')}<small>{t('Tap to open it: yours can look like this')}</small></span>
    </button>
  );
}
