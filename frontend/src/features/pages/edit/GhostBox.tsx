import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { usePagesCopy } from '../copy';
import './edit.css';

/** What filling this box means for the page: needed before it can go live, or good to have. */
export type GhostNeed = 'live' | 'recommended' | 'advanced';

/**
 * An empty box in edit mode is its own editor: a soft dashed outline, a picture and three or four words, and it fills
 * in place with a tap. `next` marks the one the setup ring points at (it breathes); `need` says in one chip whether
 * the page can go live without it (needed, recommended, or advanced such as money), so nobody fills what they could have ignored.
 */
export function GhostBox({ icon: Icon, words, hint, next = false, need, onOpen, children }: { icon: LucideIcon; words: string; hint?: string; next?: boolean; need?: GhostNeed; onOpen: () => void; children?: ReactNode }) {
  const t = usePagesCopy();
  return (
    <div className="gk-ghost" data-next={next || undefined} data-need={need}>
      <button type="button" className="gk-ghost__open" onClick={onOpen}>
        <span className="gk-ghost__icon"><Icon aria-hidden="true" /></span>
        <span className="gk-ghost__text">
          <span className="gk-ghost__words">{t(words)}</span>
          {hint && <span className="gk-ghost__hint">{t(hint)}</span>}
          {need && <span className="gk-ghost__need">{t(need === 'live' ? 'Needed to go live' : need === 'advanced' ? 'Advanced' : 'Recommended')}</span>}
        </span>
        <span className="gk-ghost__plus" aria-hidden="true"><Plus /></span>
        {next && <span className="gk-visually-hidden">{t('Next step')}</span>}
      </button>
      {children}
    </div>
  );
}
