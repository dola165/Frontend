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
      <span className="gk-example-preview__corner"><Eye aria-hidden="true" />{t('Open')}</span>
      <span className="gk-example-preview__words"><small className="gk-example-preview__ask">{t('Curious what a finished club looks like?')}</small><span className="gk-example-preview__cta"><Eye aria-hidden="true" />{t('Tap here to see one')}</span><small>{t('Yours can look like this')}</small></span>
    </button>
  );
}
