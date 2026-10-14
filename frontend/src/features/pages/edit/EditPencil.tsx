import { PenLine } from 'lucide-react';
import { usePagesCopy } from '../copy';

/** The quiet Edit in a box's head: the same look as the club page's own Edit links, but it edits here. */
export function EditPencil({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = usePagesCopy();
  return <button type="button" className="gk-section__action gk-row gk-pencil" onClick={onClick} aria-label={label}><PenLine size={13} aria-hidden="true" />{t('Edit')}</button>;
}
