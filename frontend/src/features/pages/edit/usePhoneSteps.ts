import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../../world/useMediaQuery';
import type { SetupKey } from '../model/kinds';
import { usePageEdit } from './context';

const STEPS = 'steps';

/** The phone's edit mode on a draft: open, and which card is showing, live in the address (`?steps=grounds`). */
export function usePhoneSteps() {
  const phone = useMediaQuery('(max-width: 640px)');
  const location = useLocation();
  const navigate = useNavigate();
  const { page, editing } = usePageEdit();
  const current = new URLSearchParams(location.search).get(STEPS);
  const show = (step: SetupKey | 'end' | null) => {
    const next = new URLSearchParams(location.search);
    if (step) { next.set(STEPS, step); next.set('edit', '1'); } else next.delete(STEPS);
    next.delete('new');
    navigate({ pathname: location.pathname, search: `?${next}` }, { replace: true });
  };
  // The cards are for a draft: once the page is live (the share card opens), they are gone.
  const available = phone && page?.status === 'DRAFT' && page.kind !== 'CLUB';
  return { available, open: available && editing && current ? current : null, show };
}

