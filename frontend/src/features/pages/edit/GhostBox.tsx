import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { usePagesCopy } from '../copy';
import './edit.css';

/**
 * An empty box in edit mode is its own editor: a soft dashed outline, a picture and three or four words, and it fills
 * in place with a tap. `next` marks the one the setup ring points at.
 */
export function GhostBox({ icon: Icon, words, hint, next = false, onOpen, children }: { icon: LucideIcon; words: string; hint?: string; next?: boolean; onOpen: () => void; children?: ReactNode }) {
  const t = usePagesCopy();
  return (
    <div className="gk-ghost" data-next={next || undefined}>
      <button type="button" className="gk-ghost__open" onClick={onOpen}>
        <span className="gk-ghost__icon"><Icon aria-hidden="true" /></span>
        <span className="gk-ghost__text"><span className="gk-ghost__words">{t(words)}</span>{hint && <span className="gk-ghost__hint">{t(hint)}</span>}</span>
        <span className="gk-ghost__plus" aria-hidden="true"><Plus /></span>
        {next && <span className="gk-visually-hidden">{t('Next step')}</span>}
      </button>
      {children}
    </div>
  );
}
