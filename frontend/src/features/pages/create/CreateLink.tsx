import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation, type LinkProps } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { ButtonLink, type ButtonVariant } from '../../../design/primitives';
import { usePagesCopy } from '../copy';
import type { PageKind } from '../model/kinds';
import { createHref, type CreateFrom } from './entry';
import '../pages.css';

type Props = Omit<LinkProps, 'to'> & {
  /** Pre-chosen on the sheet; null asks "What are you creating?" first. */
  kind?: PageKind | null;
  from: CreateFrom;
  draw?: boolean;
  /** A button of the design system, a plain text link, or a menu row. */
  variant?: ButtonVariant | 'text' | 'menu';
  size?: 'md' | 'sm';
  children: ReactNode;
};

/** The shared entry point to creating a page: a link that opens the start sheet over the current page. */
export function CreateLink({ kind = null, from, draw = false, variant = 'secondary', size = 'md', className, children, ...rest }: Props) {
  const location = useLocation();
  const to = createHref(location, kind, from, draw);
  if (variant === 'text') return <Link to={to} className={['gk-create-text', className].filter(Boolean).join(' ')} {...rest}>{children}</Link>;
  if (variant === 'menu') return <Link to={to} className={['gk-menu__item', className].filter(Boolean).join(' ')} {...rest}><Plus aria-hidden="true" />{children}</Link>;
  return <ButtonLink to={to} variant={variant} size={size} className={className} {...rest}>{children}</ButtonLink>;
}

/** The Home rail's card for someone without a page of their own: a picture, four words, an arrow. */
export function CreateCard({ from }: { from: CreateFrom }) {
  const t = usePagesCopy();
  const location = useLocation();
  return (
    <Link to={createHref(location, null, from)} className="gk-create-card" style={{ '--card-photo': 'url(/football/ball-field.jpg)' } as CSSProperties}>
      <span className="gk-create-card__text"><span className="gk-create-card__title">{t('Start your club or page')}</span><span className="gk-create-card__hint">{t('Your page in a minute')}</span></span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}
